import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { lateMinutes, nightHours, shiftHours, todayInBrazil } from "@/lib/payroll";
import { computePaymentPreview } from "@/lib/payment-preview";
import { getAppSettings } from "@/lib/settings";

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeDialog } from "../employee-dialog";
import { DismissEmployeeButton } from "../dismiss-employee-button";
import { DeleteEmployeeButton } from "../delete-employee-button";
import { TimeEntriesSection } from "./time-entries-section";
import { DayOffsSection } from "./day-offs-section";
import { AdvancesSection } from "./advances-section";
import { AdjustmentsSection } from "./adjustments-section";
import { PaymentSection } from "./payment-section";
import { MonthOverviewSection } from "./month-overview-section";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FuncionarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requirePermission("canManageFuncionarios");
  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();

  const [timeEntries, dayOffs, advances, adjustments, payments, users, stores] = await Promise.all([
    prisma.timeEntry.findMany({ where: { employeeId: id }, orderBy: { date: "desc" }, take: 60 }),
    prisma.dayOff.findMany({ where: { employeeId: id }, orderBy: { date: "desc" }, take: 60 }),
    prisma.advance.findMany({
      where: { employeeId: id, kind: "VALE" },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.payrollAdjustment.findMany({
      where: { employeeId: id, type: { in: ["BONUS", "DESCONTO"] } },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.payment.findMany({ where: { employeeId: id }, orderBy: { periodStart: "desc" } }),
    prisma.user.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, employee: { select: { id: true } } },
    }),
    prisma.store.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const availableUsers = users
    .filter((u) => !u.employee || u.employee.id === id)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  const lastPayment = payments[0];
  const brazilToday = todayInBrazil();
  const periodEnd = new Date(
    Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), brazilToday.getUTCDate(), 23, 59, 59),
  );
  let periodStart: Date;
  if (lastPayment) {
    periodStart = new Date(lastPayment.periodEnd.getTime() + 24 * 60 * 60 * 1000);
  } else if (employee.hireDate) {
    periodStart = new Date(employee.hireDate);
  } else {
    periodStart = new Date(
      Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), brazilToday.getUTCDate() - 60),
    );
  }

  const [hoursPreview, settings] = await Promise.all([
    computePaymentPreview(id, periodStart, periodEnd, currentUser.companyId),
    getAppSettings(currentUser.companyId),
  ]);
  const excessHours = hoursPreview.overtimeHours + hoursPreview.bankedHours;
  const regularHours = hoursPreview.totalHours - excessHours;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/funcionarios" className="text-sm text-neutral-500 hover:underline">
          ← Funcionários
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{employee.name}</h1>
            <p className="text-sm text-neutral-500">
              {employee.role ?? "Sem cargo definido"} · Salário fixo:{" "}
              {currency(Number(employee.baseSalary))}
              {employee.phone ? ` · ${employee.phone}` : ""}
              {employee.scheduledStart && employee.scheduledEnd
                ? ` · Jornada: ${employee.scheduledStart} às ${employee.scheduledEnd}`
                : ""}
              {employee.weeklyDayOff !== null
                ? ` · Folga fixa: ${WEEKDAY_NAMES[employee.weeklyDayOff]}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {employee.active ? (
              <Badge variant="secondary">Ativo</Badge>
            ) : (
              <Badge variant="destructive">Inativo</Badge>
            )}
            <EmployeeDialog
              availableUsers={availableUsers}
              stores={stores}
              employee={{
                id: employee.id,
                name: employee.name,
                role: employee.role,
                phone: employee.phone,
                baseSalary: employee.baseSalary.toString(),
                dependents: employee.dependents,
                weeklyDayOff: employee.weeklyDayOff,
                hireDate: employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : null,
                scheduledStart: employee.scheduledStart,
                scheduledEnd: employee.scheduledEnd,
                active: employee.active,
                carteiraAssinada: employee.carteiraAssinada,
                userId: employee.userId,
                storeId: employee.storeId,
              }}
            />
            <DismissEmployeeButton
              id={employee.id}
              name={employee.name}
              active={employee.active}
            />
            <DeleteEmployeeButton id={employee.id} name={employee.name} redirectTo="/funcionarios" />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Resumo de horas
            <span className="text-sm font-normal text-neutral-500">
              (período: {periodStart.toLocaleDateString("pt-BR")} a{" "}
              {periodEnd.toLocaleDateString("pt-BR")}
              {lastPayment ? ", desde o último pagamento" : ""})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">Horas normais trabalhadas</p>
              <p className="text-lg font-semibold">{regularHours.toFixed(2)}h</p>
            </div>
            {hoursPreview.overtimeMode === "HORA_EXTRA" ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-neutral-500">Horas extras</p>
                <p className="text-lg font-semibold text-primary">
                  {hoursPreview.overtimeHours.toFixed(2)}h
                </p>
              </div>
            ) : (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-neutral-500">Banco de horas</p>
                <p className="text-lg font-semibold text-primary">
                  {hoursPreview.bankedHours.toFixed(2)}h
                </p>
              </div>
            )}
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">Horas noturnas</p>
              <p className="text-lg font-semibold">{hoursPreview.totalNightHours.toFixed(2)}h</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">Atraso acumulado</p>
              <p className="text-lg font-semibold text-destructive">
                {hoursPreview.lateMinutesTotal > 0 ? `${hoursPreview.lateMinutesTotal} min` : "0 min"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">
                Desconto por atraso (tolerância legal de 5min)
              </p>
              <p className="text-lg font-semibold text-destructive">
                {hoursPreview.lateDiscountAmount > 0
                  ? `${currency(hoursPreview.lateDiscountAmount)} (${hoursPreview.lateDiscountMinutes}min)`
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <MonthOverviewSection
        periodStart={periodStart.toLocaleDateString("pt-BR")}
        periodEnd={periodEnd.toLocaleDateString("pt-BR")}
        baseSalary={hoursPreview.baseSalary}
        totalNightHours={hoursPreview.totalNightHours}
        nightPremium={hoursPreview.nightPremium}
        overtimeMode={hoursPreview.overtimeMode}
        overtimeHours={hoursPreview.overtimeHours}
        overtimeAmount={hoursPreview.overtimeAmount}
        bankedHours={hoursPreview.bankedHours}
        netAmount={hoursPreview.netAmount}
        bonusTotal={hoursPreview.bonusTotal}
        bonusItems={hoursPreview.bonusItems}
        discountTotal={hoursPreview.discountTotal}
        discountItems={hoursPreview.discountItems}
        advancesTotal={hoursPreview.advancesTotal}
        advanceItems={hoursPreview.advanceItems}
      />

      <TimeEntriesSection
        employeeId={id}
        entries={timeEntries.map((entry) => ({
          id: entry.id,
          date: entry.date.toISOString().slice(0, 10),
          clockIn: entry.clockIn.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          clockOut: entry.clockOut
            ? entry.clockOut.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : null,
          hours: entry.clockOut ? shiftHours(entry.clockIn, entry.clockOut) : null,
          nightHours: entry.clockOut ? nightHours(entry.clockIn, entry.clockOut) : 0,
          lateMinutes: lateMinutes(employee.scheduledStart, entry.clockIn),
          clockInDistanceM: entry.clockInDistanceM,
          clockOutDistanceM: entry.clockOutDistanceM,
          clockInPhoto: entry.clockInPhoto,
          clockOutPhoto: entry.clockOutPhoto,
          note: entry.note,
        }))}
      />

      <DayOffsSection
        employeeId={id}
        weeklyDayOff={employee.weeklyDayOff}
        dayOffs={dayOffs.map((dayOff) => ({
          id: dayOff.id,
          date: dayOff.date.toISOString().slice(0, 10),
          type: dayOff.type,
          reason: dayOff.reason,
        }))}
      />

      <AdvancesSection
        employeeId={id}
        advances={advances.map((advance) => ({
          id: advance.id,
          date: advance.date.toISOString().slice(0, 10),
          amount: Number(advance.amount),
          description: advance.description,
          settled: advance.paymentId !== null,
        }))}
      />

      <AdjustmentsSection
        employeeId={id}
        adjustments={adjustments.map((adjustment) => ({
          id: adjustment.id,
          type: adjustment.type as "BONUS" | "DESCONTO",
          date: adjustment.date.toISOString().slice(0, 10),
          amount: Number(adjustment.amount),
          description: adjustment.description,
          settled: adjustment.paymentId !== null,
        }))}
      />

      <PaymentSection
        employeeId={id}
        baseSalary={Number(employee.baseSalary)}
        dependents={employee.dependents}
        cltSettings={{
          inssBrackets: settings.inssBrackets as unknown as { upTo: number | null; rate: number }[],
          irrfBrackets: settings.irrfBrackets as unknown as { upTo: number | null; rate: number }[],
          irrfDependentDeduction: Number(settings.irrfDependentDeduction),
          valeTransporteRate: Number(settings.valeTransporteRate),
        }}
        payments={payments.map((payment) => ({
          id: payment.id,
          periodStart: payment.periodStart.toISOString().slice(0, 10),
          periodEnd: payment.periodEnd.toISOString().slice(0, 10),
          baseSalary: Number(payment.baseSalary),
          nightPremium: Number(payment.nightPremium),
          overtimeHours: Number(payment.overtimeHours),
          overtimeAmount: Number(payment.overtimeAmount),
          bankedHours: Number(payment.bankedHours),
          lateDiscountMinutes: Number(payment.lateDiscountMinutes),
          lateDiscountAmount: Number(payment.lateDiscountAmount),
          faltaDays: Number(payment.faltaDays),
          faltaAmount: Number(payment.faltaAmount),
          inssAmount: Number(payment.inssAmount),
          irrfAmount: Number(payment.irrfAmount),
          valeTransporteAmount: Number(payment.valeTransporteAmount),
          bonusTotal: Number(payment.bonusTotal),
          discountTotal: Number(payment.discountTotal),
          advancesTotal: Number(payment.advancesTotal),
          netAmount: Number(payment.netAmount),
          paidAt: payment.paidAt.toLocaleDateString("pt-BR"),
          note: payment.note,
        }))}
      />
    </div>
  );
}
