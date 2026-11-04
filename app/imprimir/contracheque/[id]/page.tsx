import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";
import { FOLGA_PAGA_TAG } from "@/lib/folga-comprada-shared";

const num = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

type Bracket = { upTo: number | null; rate: number };

/** Alíquota da faixa que essa base atinge (a mesma info que um holerite
 * chama de "Referência"/"Faixa" ao lado do valor de INSS/IRRF). */
function bracketRate(base: number, brackets: Bracket[]): number {
  for (const b of brackets) {
    if (b.upTo === null || base <= b.upTo) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

/** Horas no formato do holerite: 52 → "52:00", 7,5 → "7:30". */
function hhmm(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

type Row = { code: string; label: string; ref: string; vencimento: number; desconto: number };

export default async function ImprimirContrachequePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { simples: simplesParam } = await searchParams;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { employee: { include: { store: true } } },
  });
  if (!payment) notFound();

  const isOwner = payment.employee.userId === user.id;
  if (!user.role.canManageFuncionarios && !isOwner) redirect("/meu-ponto");

  // Versão simplificada (uso interno) — some com o detalhe de INSS/IRRF/FGTS,
  // fica só salário, vale, bônus e outros descontos "reais". O líquido
  // mostrado continua sendo o valor de verdade pago (com INSS/IRRF já
  // aplicados por baixo dos panos). Por padrão segue se o funcionário tem
  // carteira assinada ou não; o link no topo permite forçar pra essa
  // impressão específica.
  const simples = simplesParam ? simplesParam === "1" : !payment.employee.carteiraAssinada;

  const [settings, advances, folgasPagas] = await Promise.all([
    getAppSettings(user.companyId),
    prisma.advance.findMany({ where: { paymentId: payment.id } }),
    prisma.payrollAdjustment.findMany({
      where: { paymentId: payment.id, type: "BONUS", description: { startsWith: FOLGA_PAGA_TAG } },
    }),
  ]);
  // Folga comprada vem somada no bônus do pagamento — separa numa linha
  // própria (é verba salarial, Lei 605/49) e tira do "Bônus".
  const folgaPagaTotal = folgasPagas.reduce((s, a) => s + Number(a.amount), 0);
  const valeTotal = advances
    .filter((a) => a.kind === "VALE")
    .reduce((s, a) => s + Number(a.amount), 0);
  const adiantamentoTotal = advances
    .filter((a) => a.kind === "ADIANTAMENTO")
    .reduce((s, a) => s + Number(a.amount), 0);
  const irrfBrackets = settings.irrfBrackets as unknown as Bracket[];

  const baseSalary = Number(payment.baseSalary);
  const nightPremium = Number(payment.nightPremium);
  const overtimeAmount = Number(payment.overtimeAmount);
  const overtimeHours = Number(payment.overtimeHours);
  const bonusTotal = Number(payment.bonusTotal) - folgaPagaTotal;
  const attendanceBonusAmount = Number(payment.attendanceBonusAmount);
  const lateDiscountAmount = Number(payment.lateDiscountAmount);
  const lateDiscountMinutes = Number(payment.lateDiscountMinutes);
  const faltaAmount = Number(payment.faltaAmount);
  const faltaDays = Number(payment.faltaDays);
  const holidayBonusAmount = Number(payment.holidayBonusAmount);
  const inssAmount = Number(payment.inssAmount);
  const irrfAmount = Number(payment.irrfAmount);
  const valeTransporteAmount = Number(payment.valeTransporteAmount);
  const discountTotal = Number(payment.discountTotal);
  const netAmount = Number(payment.netAmount);
  const dsrExtrasAmount = Number(payment.dsrExtrasAmount);
  const dsrNightAmount = Number(payment.dsrNightAmount);
  const salarioContratual = Number(payment.employee.baseSalary);
  const valorHora = salarioContratual / 220;
  // Pagamentos antigos não guardavam as horas — recalcula a partir do valor.
  const nightHours =
    Number(payment.nightHours) || (valorHora > 0 ? nightPremium / (valorHora * 0.2) : 0);
  const holidayHours =
    Number(payment.holidayHours) || (valorHora > 0 ? holidayBonusAmount / (valorHora * 2) : 0);

  // Base de INSS/FGTS: verbas salariais (sem folga comprada) menos faltas — a
  // mesma usada no fechamento do pagamento. Atraso desconta só no líquido.
  const grossForTax = Math.max(
    0,
    baseSalary +
      nightPremium +
      overtimeAmount +
      holidayBonusAmount +
      dsrExtrasAmount +
      dsrNightAmount -
      faltaAmount,
  );
  const irrfBase = Math.max(
    0,
    grossForTax - inssAmount - payment.employee.dependents * Number(settings.irrfDependentDeduction),
  );
  const fgtsMes = grossForTax * 0.08;

  // "Horas normais" — 220h no mês cheio (mensalista); proporcional se o
  // salário do período veio menor (admitido no meio do mês).
  const horasNormais = salarioContratual > 0 ? Math.min(220, (baseSalary / salarioContratual) * 220) : 220;

  // Mesmos códigos e ordem do holerite da contabilidade.
  const rows: Row[] = [
    { code: "1", label: "Horas Normais", ref: hhmm(horasNormais), vencimento: baseSalary, desconto: 0 },
  ];
  if (dsrExtrasAmount > 0) {
    rows.push({ code: "8125", label: "Reflexo Horas Extras DSR", ref: "0:00", vencimento: dsrExtrasAmount, desconto: 0 });
  }
  if (dsrNightAmount > 0) {
    rows.push({ code: "8924", label: "Reflexo Horas Adic. Noturno DSR", ref: "0:00", vencimento: dsrNightAmount, desconto: 0 });
  }
  if (holidayBonusAmount > 0) {
    rows.push({ code: "202", label: "Horas Feriado 100%", ref: hhmm(holidayHours), vencimento: holidayBonusAmount, desconto: 0 });
  }
  if (nightPremium > 0) {
    rows.push({ code: "201", label: "Adicional Noturno 20%", ref: hhmm(nightHours), vencimento: nightPremium, desconto: 0 });
  }
  if (overtimeAmount > 0) {
    rows.push({
      code: "003",
      label: "Horas Extras",
      ref: `${overtimeHours.toFixed(2)}h`,
      vencimento: overtimeAmount,
      desconto: 0,
    });
  }
  if (folgaPagaTotal > 0) {
    rows.push({
      code: "007",
      label: "Folga Trabalhada em Dobro (Lei 605/49)",
      ref: `${num(folgasPagas.length)}`,
      vencimento: folgaPagaTotal,
      desconto: 0,
    });
  }
  if (bonusTotal > 0.004) {
    rows.push({ code: "004", label: "Bônus", ref: "", vencimento: bonusTotal, desconto: 0 });
  }
  if (attendanceBonusAmount > 0) {
    rows.push({
      code: "005",
      label: "Bônus Assiduidade/Pontualidade",
      ref: "",
      vencimento: attendanceBonusAmount,
      desconto: 0,
    });
  }
  if (faltaAmount > 0) {
    rows.push({ code: "101", label: "Faltas", ref: `${num(faltaDays)}`, vencimento: 0, desconto: faltaAmount });
  }
  if (lateDiscountAmount > 0) {
    rows.push({
      code: "102",
      label: "Atraso",
      ref: `${lateDiscountMinutes.toFixed(0)}min`,
      vencimento: 0,
      desconto: lateDiscountAmount,
    });
  }
  if (inssAmount > 0 && !simples) {
    rows.push({
      code: "998",
      label: "I.N.S.S.",
      // Alíquota efetiva (INSS ÷ base), como a contabilidade mostra.
      ref: grossForTax > 0 ? num((inssAmount / grossForTax) * 100) : "",
      vencimento: 0,
      desconto: inssAmount,
    });
  }
  if (adiantamentoTotal > 0) {
    rows.push({
      code: "981",
      label: "Desc.Adiant.Salarial",
      ref: num(adiantamentoTotal),
      vencimento: 0,
      desconto: adiantamentoTotal,
    });
  }
  if (irrfAmount > 0 && !simples) {
    rows.push({
      code: "999",
      label: "I.R.R.F.",
      ref: `${num(bracketRate(irrfBase, irrfBrackets) * 100)}`,
      vencimento: 0,
      desconto: irrfAmount,
    });
  }
  if (valeTransporteAmount > 0) {
    rows.push({
      code: "106",
      label: "Vale-Transporte",
      ref: `${num(Number(settings.valeTransporteRate))}`,
      vencimento: 0,
      desconto: valeTransporteAmount,
    });
  }
  if (discountTotal > 0) {
    rows.push({ code: "107", label: "Descontos diversos", ref: "", vencimento: 0, desconto: discountTotal });
  }
  if (valeTotal > 0) {
    rows.push({ code: "108", label: "Vale", ref: "", vencimento: 0, desconto: valeTotal });
  }

  const totalVencimentos = rows.reduce((s, r) => s + r.vencimento, 0);
  const totalDescontos = rows.reduce((s, r) => s + r.desconto, 0);

  const competencia = payment.periodEnd.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const emp = payment.employee;
  const competenciaLabel = competencia.charAt(0).toUpperCase() + competencia.slice(1);
  const filial = emp.filial || "1";
  const empresa = settings.labelEmpresa || "Empresa";
  // Corpo da tabela com altura fixa, como o formulário da contabilidade —
  // baixa o bastante pras duas vias caberem numa folha A4.
  const linhasVazias = Math.max(0, 8 - rows.length);
  const cell = "px-2 py-0";

  const payslip = (
    <div className="flex w-full break-inside-avoid gap-2 font-mono text-[10px] leading-tight text-black">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="border border-black px-2 py-1">
          <p className="uppercase">{empresa}</p>
          <div className="grid grid-cols-3 items-end">
            <p>CNPJ: {settings.labelCnpj || "—"}</p>
            <p className="text-center">CC: Centro de Custo</p>
            <p className="text-right">Folha Mensal</p>
            <p className="font-bold uppercase">
              {filial} - {empresa}
            </p>
            <p className="text-center">Mensalista</p>
            <p className="text-right">{competenciaLabel}</p>
          </div>
        </div>

        <div className="border border-black px-2 py-1">
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_7rem_4rem_5rem_3rem] gap-x-2 font-sans text-[9px]">
            <p className="text-center">Código</p>
            <p>Nome do Funcionário</p>
            <p className="text-center">CPF</p>
            <p className="text-center">CBO</p>
            <p className="text-center">Departamento</p>
            <p className="text-center">Filial</p>
          </div>
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_7rem_4rem_5rem_3rem] gap-x-2">
            <p className="text-center">{emp.matricula ?? ""}</p>
            <p className="uppercase">{emp.name}</p>
            <p className="text-center font-bold">{emp.cpf ?? ""}</p>
            <p className="text-center">{emp.cbo ?? ""}</p>
            <p className="text-center">{emp.departamento ?? ""}</p>
            <p className="text-center">{emp.filial ?? ""}</p>
            <p />
            <p className="uppercase">{emp.role ?? ""}</p>
            <p />
            <p className="col-span-2 text-right">Admissão:</p>
            <p className="text-right">{emp.hireDate ? brDate(emp.hireDate) : ""}</p>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse border border-black">
          <thead className="font-sans">
            <tr className="border-b border-black">
              <th className="w-14 border-r border-black px-1 font-normal">Código</th>
              <th className="border-r border-black px-1 font-normal">Descrição</th>
              <th className="w-24 border-r border-black px-1 font-normal">Referência</th>
              <th className="w-24 border-r border-black px-1 font-normal">Vencimentos</th>
              <th className="w-24 px-1 font-normal">Descontos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className={`border-r border-black text-right ${cell}`}>{r.code}</td>
                <td className={`border-r border-black uppercase ${cell}`}>{r.label}</td>
                <td className={`border-r border-black text-right ${cell}`}>{r.ref}</td>
                <td className={`border-r border-black text-right ${cell}`}>
                  {r.vencimento > 0 ? num(r.vencimento) : ""}
                </td>
                <td className={`text-right ${cell}`}>{r.desconto > 0 ? num(r.desconto) : ""}</td>
              </tr>
            ))}
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <tr key={`v-${i}`}>
                <td className={`border-r border-black ${cell}`}>&nbsp;</td>
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-[minmax(0,1fr)_12rem_12rem] border border-black">
          <div className="row-span-2" />
          <div className="border-l border-black px-2 py-1 text-right">
            <p className="text-center font-sans text-[9px]">Total de Vencimentos</p>
            <p>{num(totalVencimentos)}</p>
          </div>
          <div className="border-l border-black px-2 py-1 text-right">
            <p className="text-center font-sans text-[9px]">Total de Descontos</p>
            <p>{num(totalDescontos)}</p>
          </div>
          <div className="flex items-center justify-between border-l border-t border-black px-2 py-1 font-sans text-[9px]">
            <span>Valor Líquido</span>
            <span className="text-base">⇨</span>
          </div>
          <div className="border-l border-t border-black px-2 py-1 text-right font-bold">{num(netAmount)}</div>
        </div>

        <div className={`grid border border-black text-center ${simples ? "grid-cols-1" : "grid-cols-6"}`}>
          {[
            ["Salário Base", num(salarioContratual)],
            ...(simples
              ? []
              : [
                  ["Sal. Contr. INSS", num(grossForTax)],
                  ["Base Cálc. FGTS", num(grossForTax)],
                  ["F.G.T.S do Mês", num(fgtsMes)],
                  ["Base Cálc. IRRF", num(irrfBase)],
                  ["Faixa IRRF", num(bracketRate(irrfBase, irrfBrackets) * 100)],
                ]),
          ].map(([k, v]) => (
            <div key={k} className="px-1 py-0.5">
              <p className="font-sans text-[9px]">{k}</p>
              <p>{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-14 shrink-0 items-stretch border border-black font-sans text-[8px]">
        <p className="flex-1 [writing-mode:vertical-rl] rotate-180 py-2 text-center">
          Declaro ter recebido a importância líquida discriminada neste recibo.
        </p>
        <div className="flex flex-1 flex-col justify-between py-2">
          <p className="[writing-mode:vertical-rl] rotate-180 border-r border-black text-center">
            Assinatura do Funcionário
          </p>
          <p className="[writing-mode:vertical-rl] rotate-180 text-center">Data ___/___/____</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8 print:gap-2 print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: A4; margin: 6mm; } }",
        }}
      />
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Recibo de pagamento para impressão</p>
        <div className="flex items-center gap-3">
          <Link
            href={`?simples=${simples ? "0" : "1"}`}
            className="text-sm text-primary hover:underline"
          >
            {simples ? "Ver versão completa" : "Ver versão simplificada (sem INSS/IRRF/FGTS)"}
          </Link>
          <PrintButton />
        </div>
      </div>

      {payslip}
      <div className="my-0.5 border-t border-dashed border-neutral-400 text-center text-[9px] text-neutral-400">
        ✂ via da empresa
      </div>
      {payslip}

      {payment.note && (
        <p className="text-xs text-neutral-500 print:hidden">Observação: {payment.note}</p>
      )}
    </div>
  );
}
