import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });

function Linha({ label, value, sub }: { label: string; value: number; sub?: string }) {
  if (value <= 0) return null;
  return (
    <div className="flex items-baseline justify-between border-b border-dashed py-1 text-sm">
      <span>
        {label}
        {sub && <span className="ml-1 text-xs text-neutral-500">({sub})</span>}
      </span>
      <span className="font-medium">{currency(value)}</span>
    </div>
  );
}

export default async function ImprimirContrachequePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!payment) notFound();

  const isOwner = payment.employee.userId === user.id;
  if (!user.role.canManageFuncionarios && !isOwner) redirect("/meu-ponto");

  const settings = await getAppSettings(user.companyId);

  const baseSalary = Number(payment.baseSalary);
  const nightPremium = Number(payment.nightPremium);
  const overtimeAmount = Number(payment.overtimeAmount);
  const bonusTotal = Number(payment.bonusTotal);
  const attendanceBonusAmount = Number(payment.attendanceBonusAmount);
  const totalProventos =
    baseSalary + nightPremium + overtimeAmount + bonusTotal + attendanceBonusAmount;

  const lateDiscountAmount = Number(payment.lateDiscountAmount);
  const faltaAmount = Number(payment.faltaAmount);
  const inssAmount = Number(payment.inssAmount);
  const irrfAmount = Number(payment.irrfAmount);
  const valeTransporteAmount = Number(payment.valeTransporteAmount);
  const discountTotal = Number(payment.discountTotal);
  const advancesTotal = Number(payment.advancesTotal);
  const totalDescontos =
    lateDiscountAmount +
    faltaAmount +
    inssAmount +
    irrfAmount +
    valeTransporteAmount +
    discountTotal +
    advancesTotal;

  const netAmount = Number(payment.netAmount);
  const overtimeHours = Number(payment.overtimeHours);
  const bankedHours = Number(payment.bankedHours);
  const faltaDays = Number(payment.faltaDays);
  const lateDiscountMinutes = Number(payment.lateDiscountMinutes);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Recibo de pagamento para impressão</p>
        <PrintButton />
      </div>

      <div className="flex flex-col gap-1 border-b border-dashed pb-4 text-center">
        {settings.labelEmpresa && (
          <p className="text-sm font-bold uppercase">{settings.labelEmpresa}</p>
        )}
        <p className="text-xs text-neutral-500">
          {[
            settings.labelCnpj ? `CNPJ ${settings.labelCnpj}` : null,
            settings.labelEndereco,
            settings.labelCidade,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="mt-2 text-lg font-bold uppercase">Recibo de Pagamento de Salário</h1>
        <p className="text-sm text-neutral-600">
          Período: {brDate(payment.periodStart)} a {brDate(payment.periodEnd)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-neutral-500">Funcionário: </span>
          <span className="font-medium">{payment.employee.name}</span>
        </div>
        <div>
          <span className="text-neutral-500">Cargo: </span>
          <span className="font-medium">{payment.employee.role ?? "—"}</span>
        </div>
        {payment.employee.hireDate && (
          <div>
            <span className="text-neutral-500">Admissão: </span>
            <span className="font-medium">{brDate(payment.employee.hireDate)}</span>
          </div>
        )}
        <div>
          <span className="text-neutral-500">Pago em: </span>
          <span className="font-medium">{brDate(payment.paidAt)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">Proventos</h2>
        <Linha label="Salário base" value={baseSalary} />
        <Linha label="Adicional noturno" value={nightPremium} />
        <Linha
          label="Horas extras"
          value={overtimeAmount}
          sub={overtimeHours > 0 ? `${overtimeHours.toFixed(2)}h` : undefined}
        />
        <Linha label="Bônus" value={bonusTotal} />
        <Linha label="Bônus de assiduidade/pontualidade" value={attendanceBonusAmount} />
        <div className="flex justify-between pt-1 text-sm font-semibold">
          <span>Total de proventos</span>
          <span>{currency(totalProventos)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase text-neutral-500">Descontos</h2>
        <Linha
          label="Atraso"
          value={lateDiscountAmount}
          sub={lateDiscountMinutes > 0 ? `${lateDiscountMinutes} min` : undefined}
        />
        <Linha label="Faltas" value={faltaAmount} sub={faltaDays > 0 ? `${faltaDays} dia(s)` : undefined} />
        <Linha label="INSS" value={inssAmount} />
        <Linha label="IRRF" value={irrfAmount} />
        <Linha label="Vale-transporte" value={valeTransporteAmount} />
        <Linha label="Descontos diversos" value={discountTotal} />
        <Linha label="Vales/adiantamentos" value={advancesTotal} />
        <div className="flex justify-between pt-1 text-sm font-semibold">
          <span>Total de descontos</span>
          <span>{currency(totalDescontos)}</span>
        </div>
      </div>

      <div className="flex justify-between border-y-2 border-black py-2 text-base font-bold">
        <span>Líquido a receber</span>
        <span>{currency(netAmount)}</span>
      </div>

      <p className="text-xs text-neutral-500">
        Pontuação de assiduidade/pontualidade no período: {payment.attendanceScore}/100
        {payment.attendanceStreakMonths > 0 &&
          ` · ${payment.attendanceStreakMonths} mês(es) seguido(s) sem falta`}
        {bankedHours > 0 && ` · ${bankedHours.toFixed(2)}h em banco de horas`}
        {payment.note && (
          <>
            <br />
            Observação: {payment.note}
          </>
        )}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs text-neutral-500">
        <div className="border-t pt-1">Assinatura do funcionário</div>
        <div className="border-t pt-1">Assinatura da empresa</div>
      </div>
    </div>
  );
}
