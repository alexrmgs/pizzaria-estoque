import { prisma } from "@/lib/prisma";
import { computePaymentPreview } from "@/lib/payment-preview";
import { monthRange } from "@/lib/relatorio-ponto";

// CMO (custo de mão de obra) do mês: quanto a empresa gastou com cada
// funcionário na competência — salário e adicionais já com faltas/atrasos
// descontados, madrugada, FGTS estimado e rescisões. Quem ainda não teve a
// folha fechada entra com o valor previsto (mesma conta da tela de
// pagamento), marcado como "estimado".

// FGTS: 8% sobre a remuneração de quem tem carteira assinada. Não é
// guardado no sistema, então é estimado aqui.
export const FGTS_RATE = 0.08;

export type CmoFuncionario = {
  id: string;
  name: string;
  role: string | null;
  storeName: string | null;
  carteiraAssinada: boolean;
  status: "FECHADA" | "ESTIMADA";
  salario: number;
  adicionalNoturno: number;
  horasExtras: number;
  feriados: number;
  bonus: number; // bônus lançados + bônus de assiduidade
  descontos: number; // faltas + atrasos + outros descontos (reduzem o custo)
  madrugada: number;
  fgts: number;
  rescisao: number; // líquido da rescisão + multa do FGTS
  total: number;
  // Informativo: o que já saiu como vale/adiantamento dentro do mês.
  adiantamentos: number;
};

export type RelatorioCmo = {
  funcionarios: CmoFuncionario[];
  total: number;
  faturamento: number;
  percentual: number | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export async function buildRelatorioCmo(mes: string, companyId: string): Promise<RelatorioCmo> {
  const { start, end } = monthRange(mes);

  const [employees, payments, madrugadas, rescisoes, revenues] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [
          { active: true },
          { payments: { some: { periodEnd: { gte: start, lte: end } } } },
          { timeEntries: { some: { date: { gte: start, lte: end } } } },
        ],
      },
      orderBy: { name: "asc" },
      include: { store: { select: { name: true } } },
    }),
    prisma.payment.findMany({ where: { periodEnd: { gte: start, lte: end } } }),
    prisma.payrollAdjustment.findMany({
      where: { type: "MADRUGADA", date: { gte: start, lte: end } },
      select: { employeeId: true, amount: true },
    }),
    prisma.termination.findMany({
      where: { companyId, dismissalDate: { gte: start, lte: end } },
      select: { employeeId: true, totalLiquido: true, multaFgts: true },
    }),
    // Funcionários são da FB Eusébio — faturamento de outras lojas não
    // entra pra não distorcer o % do CMO (mesmo critério do CMV no dashboard).
    prisma.revenue.findMany({
      where: { date: { gte: start, lte: end }, store: { name: "FB EUSEBIO", companyId } },
      select: { amount: true },
    }),
  ]);

  const today = new Date();
  const funcionarios: CmoFuncionario[] = [];

  for (const e of employees) {
    // Admitido depois do mês → não entra.
    if (e.hireDate && e.hireDate > end) continue;

    const pagos = payments.filter((p) => p.employeeId === e.id);
    const madrugada = madrugadas
      .filter((m) => m.employeeId === e.id)
      .reduce((s, m) => s + Number(m.amount), 0);
    const resc = rescisoes
      .filter((r) => r.employeeId === e.id)
      .reduce((s, r) => s + Number(r.totalLiquido) + Number(r.multaFgts), 0);

    let linha: Omit<CmoFuncionario, "fgts" | "total" | "madrugada" | "rescisao">;

    if (pagos.length > 0) {
      const sum = (fn: (p: (typeof pagos)[number]) => unknown) =>
        pagos.reduce((s, p) => s + Number(fn(p)), 0);
      linha = {
        id: e.id,
        name: e.name,
        role: e.role,
        storeName: e.store?.name ?? null,
        carteiraAssinada: e.carteiraAssinada,
        status: "FECHADA",
        salario: sum((p) => p.baseSalary),
        adicionalNoturno: sum((p) => p.nightPremium),
        horasExtras: sum((p) => p.overtimeAmount),
        feriados: sum((p) => p.holidayBonusAmount),
        bonus: sum((p) => p.bonusTotal) + sum((p) => p.attendanceBonusAmount),
        descontos: sum((p) => p.faltaAmount) + sum((p) => p.lateDiscountAmount) + sum((p) => p.discountTotal),
        adiantamentos: sum((p) => p.advancesTotal),
      };
    } else {
      // Desligado antes do mês e sem folha nele → não tem custo de salário.
      if (!e.active && resc === 0 && madrugada === 0) continue;
      // Mês ainda em andamento: previsão até hoje, não o mês inteiro.
      const fim = end > today ? today : end;
      const p = await computePaymentPreview(e.id, start, fim, companyId);
      linha = {
        id: e.id,
        name: e.name,
        role: e.role,
        storeName: e.store?.name ?? null,
        carteiraAssinada: e.carteiraAssinada,
        status: "ESTIMADA",
        salario: e.active ? p.proratedBaseSalary : 0,
        adicionalNoturno: p.nightPremium,
        horasExtras: p.overtimeAmount,
        feriados: p.holidayBonusAmountAuto,
        bonus: p.bonusTotal + p.attendanceBonusAmount,
        descontos: p.faltaAmountAuto + p.lateDiscountAmount + p.discountTotal,
        adiantamentos: p.advancesTotal,
      };
    }

    const remuneracao = linha.salario + linha.adicionalNoturno + linha.horasExtras + linha.feriados;
    const fgts = linha.carteiraAssinada ? (remuneracao - linha.descontos) * FGTS_RATE : 0;
    const total =
      remuneracao + linha.bonus - linha.descontos + madrugada + Math.max(0, fgts) + resc;

    funcionarios.push({
      ...linha,
      salario: round(linha.salario),
      adicionalNoturno: round(linha.adicionalNoturno),
      horasExtras: round(linha.horasExtras),
      feriados: round(linha.feriados),
      bonus: round(linha.bonus),
      descontos: round(linha.descontos),
      adiantamentos: round(linha.adiantamentos),
      madrugada: round(madrugada),
      fgts: round(Math.max(0, fgts)),
      rescisao: round(resc),
      total: round(total),
    });
  }

  const total = round(funcionarios.reduce((s, f) => s + f.total, 0));
  const faturamento = round(revenues.reduce((s, r) => s + Number(r.amount), 0));
  return {
    funcionarios,
    total,
    faturamento,
    percentual: faturamento > 0 ? (total / faturamento) * 100 : null,
  };
}
