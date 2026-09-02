import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

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

  const [settings, advances] = await Promise.all([
    getAppSettings(user.companyId),
    prisma.advance.findMany({ where: { paymentId: payment.id } }),
  ]);
  const valeTotal = advances
    .filter((a) => a.kind === "VALE")
    .reduce((s, a) => s + Number(a.amount), 0);
  const adiantamentoTotal = advances
    .filter((a) => a.kind === "ADIANTAMENTO")
    .reduce((s, a) => s + Number(a.amount), 0);
  const inssBrackets = settings.inssBrackets as unknown as Bracket[];
  const irrfBrackets = settings.irrfBrackets as unknown as Bracket[];

  const baseSalary = Number(payment.baseSalary);
  const nightPremium = Number(payment.nightPremium);
  const overtimeAmount = Number(payment.overtimeAmount);
  const overtimeHours = Number(payment.overtimeHours);
  const bonusTotal = Number(payment.bonusTotal);
  const attendanceBonusAmount = Number(payment.attendanceBonusAmount);
  const lateDiscountAmount = Number(payment.lateDiscountAmount);
  const lateDiscountMinutes = Number(payment.lateDiscountMinutes);
  const faltaAmount = Number(payment.faltaAmount);
  const faltaDays = Number(payment.faltaDays);
  const inssAmount = Number(payment.inssAmount);
  const irrfAmount = Number(payment.irrfAmount);
  const valeTransporteAmount = Number(payment.valeTransporteAmount);
  const discountTotal = Number(payment.discountTotal);
  const netAmount = Number(payment.netAmount);

  // Base de cálculo padrão (salário + adicional noturno + hora extra) — a
  // mesma usada no fechamento do pagamento pra INSS/IRRF/FGTS.
  const grossForTax = baseSalary + nightPremium + overtimeAmount;
  const irrfBase = Math.max(
    0,
    grossForTax - inssAmount - payment.employee.dependents * Number(settings.irrfDependentDeduction),
  );
  const fgtsMes = grossForTax * 0.08;

  // "Dias normais" — 30 se o mês foi trabalhado inteiro (convenção do
  // mensalista); proporcional se o salário do período veio menor que o
  // salário contratual atual (admitido no meio do mês).
  const salarioContratual = Number(payment.employee.baseSalary);
  const diasNormais =
    salarioContratual > 0 ? Math.min(30, Math.round((baseSalary / salarioContratual) * 30)) : 30;

  const rows: Row[] = [
    { code: "001", label: "Salário Base", ref: `${num(diasNormais)}`, vencimento: baseSalary, desconto: 0 },
  ];
  if (nightPremium > 0) {
    rows.push({ code: "002", label: "Adicional Noturno (20%)", ref: "", vencimento: nightPremium, desconto: 0 });
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
  if (bonusTotal > 0) {
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
      ref: `${num(bracketRate(grossForTax, inssBrackets) * 100)}`,
      vencimento: 0,
      desconto: inssAmount,
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
  if (adiantamentoTotal > 0) {
    rows.push({
      code: "109",
      label: "Adiantamento Quinzenal (40%)",
      ref: "",
      vencimento: 0,
      desconto: adiantamentoTotal,
    });
  }

  const totalVencimentos = rows.reduce((s, r) => s + r.vencimento, 0);
  const totalDescontos = rows.reduce((s, r) => s + r.desconto, 0);

  const competencia = payment.periodEnd.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const employeeName = payment.employee.name;
  const employeeRole = payment.employee.role;
  const employeeHireDate = payment.employee.hireDate;
  const employeeDependents = payment.employee.dependents;
  const employeeStoreName = payment.employee.store?.name ?? null;
  const periodStartDate = payment.periodStart;
  const periodEndDate = payment.periodEnd;

  const payslip = (
      <div className="w-full border border-black text-[11px]">
        <div className="flex items-start justify-between border-b border-black px-2 py-1">
          <div>
            <p className="font-bold uppercase">{settings.labelEmpresa || "Empresa"}</p>
            <p>
              CNPJ: {settings.labelCnpj || "—"}
              {employeeStoreName && <> &nbsp;&nbsp;CC: {employeeStoreName}</>}
            </p>
            <p>Mensalista</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Folha Mensal</p>
            <p className="capitalize">{competencia}</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-black px-2 py-1">
          <div>
            <p className="text-[9px] text-neutral-500">Nome do Funcionário</p>
            <p className="font-medium uppercase">{employeeName}</p>
            <p className="uppercase text-neutral-600">
              {employeeRole ?? "—"}
              {employeeHireDate && (
                <span className="ml-3">Admissão: {brDate(employeeHireDate)}</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-neutral-500">Dependentes IRRF</p>
            <p>{employeeDependents}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-neutral-500">Período</p>
            <p>
              {brDate(periodStartDate)} a {brDate(periodEndDate)}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black bg-neutral-100">
              <th className="w-10 border-r border-black px-1 py-0.5 text-left font-semibold">Código</th>
              <th className="border-r border-black px-1 py-0.5 text-left font-semibold">Descrição</th>
              <th className="w-16 border-r border-black px-1 py-0.5 text-right font-semibold">Referência</th>
              <th className="w-20 border-r border-black px-1 py-0.5 text-right font-semibold">Vencimentos</th>
              <th className="w-20 px-1 py-0.5 text-right font-semibold">Descontos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-neutral-300">
                <td className="border-r border-black px-1 py-0.5">{r.code}</td>
                <td className="border-r border-black px-1 py-0.5 uppercase">{r.label}</td>
                <td className="border-r border-black px-1 py-0.5 text-right">{r.ref}</td>
                <td className="border-r border-black px-1 py-0.5 text-right">
                  {r.vencimento > 0 ? num(r.vencimento) : ""}
                </td>
                <td className="px-1 py-0.5 text-right">{r.desconto > 0 ? num(r.desconto) : ""}</td>
              </tr>
            ))}
            {/* Preenche até um mínimo de linhas, como no formulário impresso. */}
            {Array.from({ length: Math.max(0, 3 - rows.length) }).map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-neutral-300">
                <td className="border-r border-black px-1 py-1">&nbsp;</td>
                <td className="border-r border-black px-1 py-1"></td>
                <td className="border-r border-black px-1 py-1"></td>
                <td className="border-r border-black px-1 py-1"></td>
                <td className="px-1 py-1"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-black">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-24 border-b border-l border-black px-2 py-0.5 text-right font-semibold">
                  Total de Vencimentos
                </th>
                <th className="w-24 border-b border-l border-black px-2 py-0.5 text-right font-semibold">
                  Total de Descontos
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-l border-black px-2 py-0.5 text-right">{num(totalVencimentos)}</td>
                <td className="border-l border-black px-2 py-0.5 text-right">{num(totalDescontos)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-black">
          <div className="flex w-48 items-center justify-between border-l border-black px-2 py-1 font-bold">
            <span>Valor Líquido</span>
            <span>{num(netAmount)}</span>
          </div>
        </div>
        <table className="w-full border-collapse border-t border-black text-center">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border-r border-black px-1 py-0.5 font-semibold">Salário Base</th>
              {!simples && (
                <>
                  <th className="border-r border-black px-1 py-0.5 font-semibold">Sal. Contr. INSS</th>
                  <th className="border-r border-black px-1 py-0.5 font-semibold">Base Cálc. FGTS</th>
                  <th className="border-r border-black px-1 py-0.5 font-semibold">F.G.T.S do Mês</th>
                  <th className="border-r border-black px-1 py-0.5 font-semibold">Base Cálc. IRRF</th>
                  <th className="px-1 py-0.5 font-semibold">Faixa IRRF</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={simples ? "px-1 py-0.5" : "border-r border-black px-1 py-0.5"}>
                {num(salarioContratual)}
              </td>
              {!simples && (
                <>
                  <td className="border-r border-black px-1 py-0.5">{num(grossForTax)}</td>
                  <td className="border-r border-black px-1 py-0.5">{num(grossForTax)}</td>
                  <td className="border-r border-black px-1 py-0.5">{num(fgtsMes)}</td>
                  <td className="border-r border-black px-1 py-0.5">{num(irrfBase)}</td>
                  <td className="px-1 py-0.5">{num(bracketRate(irrfBase, irrfBrackets) * 100)}</td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        <div className="border-t border-black px-2 py-2">
          <p className="text-[9px] leading-tight text-neutral-600">
            Declaro ter recebido a importância líquida discriminada neste recibo.
          </p>
          <div className="mt-5 flex justify-end gap-6 text-center text-[9px]">
            <div className="w-40 border-t border-black pt-0.5">Assinatura do Funcionário</div>
            <div className="w-20 border-t border-black pt-0.5">Data ___/___/____</div>
          </div>
        </div>
      </div>
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8 print:gap-2 print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: A4; margin: 8mm; } }",
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
