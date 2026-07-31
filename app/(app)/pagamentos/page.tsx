import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { nthBusinessDayOfMonth, previousMonthRange, SALARY_ADVANCE_TAG } from "@/lib/payroll";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClosePaymentDialog } from "../funcionarios/close-payment-dialog";
import { GenerateAdvancesButton } from "../vales/generate-advances-button";
import { PaymentMonthSection } from "./payment-month-section";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PagamentosPage() {
  await requirePermission("canManageFuncionarios");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [employees, pendingAdvances, monthAdvances, lastPayments, allPayments, settings] =
    await Promise.all([
      prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.advance.findMany({ where: { paymentId: null } }),
      prisma.advance.findMany({
        where: { description: SALARY_ADVANCE_TAG, date: { gte: monthStart, lte: monthEnd } },
        orderBy: { date: "desc" },
        include: { employee: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        orderBy: { periodEnd: "desc" },
        distinct: ["employeeId"],
        select: { employeeId: true, periodStart: true, periodEnd: true, netAmount: true, paidAt: true },
      }),
      prisma.payment.findMany({
        orderBy: { periodStart: "desc" },
        include: { employee: { select: { name: true } } },
      }),
      getAppSettings(),
    ]);

  const pendingAdiantamentoByEmployee = new Map<string, number>();
  const pendingOutrosValesByEmployee = new Map<string, number>();
  for (const advance of pendingAdvances) {
    const map =
      advance.description === SALARY_ADVANCE_TAG
        ? pendingAdiantamentoByEmployee
        : pendingOutrosValesByEmployee;
    map.set(advance.employeeId, (map.get(advance.employeeId) ?? 0) + Number(advance.amount));
  }
  const lastPaymentByEmployee = new Map(lastPayments.map((p) => [p.employeeId, p]));

  const prevMonth = previousMonthRange(now);
  const deadline = nthBusinessDayOfMonth(now.getFullYear(), now.getMonth(), 5);
  const deadlineEndOfDay = new Date(deadline);
  deadlineEndOfDay.setHours(23, 59, 59, 999);
  const isOverdue = now > deadlineEndOfDay;
  const prevMonthLabel = prevMonth.start.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const cltSettings = {
    inssBrackets: settings.inssBrackets as unknown as { upTo: number | null; rate: number }[],
    irrfBrackets: settings.irrfBrackets as unknown as { upTo: number | null; rate: number }[],
    irrfDependentDeduction: Number(settings.irrfDependentDeduction),
    valeTransporteRate: Number(settings.valeTransporteRate),
  };

  // Agrupa o histórico de pagamentos por mês (com base no início do período),
  // do mais recente pro mais antigo, cada um com o total líquido pago no mês.
  type MonthGroup = {
    key: string;
    label: string;
    totalNet: number;
    payments: {
      id: string;
      employeeId: string;
      employeeName: string;
      periodStart: string;
      periodEnd: string;
      advancesTotal: number;
      cltTotal: number;
      netAmount: number;
      paidAt: string;
    }[];
  };
  const monthGroups: MonthGroup[] = [];
  const monthGroupByKey = new Map<string, MonthGroup>();
  for (const payment of allPayments) {
    const key = `${payment.periodStart.getUTCFullYear()}-${String(payment.periodStart.getUTCMonth() + 1).padStart(2, "0")}`;
    let group = monthGroupByKey.get(key);
    if (!group) {
      const label = payment.periodStart.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key, label, totalNet: 0, payments: [] };
      monthGroupByKey.set(key, group);
      monthGroups.push(group);
    }
    const cltTotal =
      Number(payment.faltaAmount) +
      Number(payment.inssAmount) +
      Number(payment.irrfAmount) +
      Number(payment.valeTransporteAmount);
    const netAmount = Number(payment.netAmount);
    group.totalNet += netAmount;
    group.payments.push({
      id: payment.id,
      employeeId: payment.employeeId,
      employeeName: payment.employee.name,
      periodStart: payment.periodStart.toISOString().slice(0, 10),
      periodEnd: payment.periodEnd.toISOString().slice(0, 10),
      advancesTotal: Number(payment.advancesTotal),
      cltTotal,
      netAmount,
      paidAt: payment.paidAt.toLocaleDateString("pt-BR"),
    });
  }

  const employeesToPay: typeof employees = [];
  const employeesPaid: typeof employees = [];
  for (const employee of employees) {
    const lastPayment = lastPaymentByEmployee.get(employee.id);
    const prevMonthClosed = !!lastPayment && lastPayment.periodEnd >= prevMonth.end;
    (prevMonthClosed ? employeesPaid : employeesToPay).push(employee);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pagamentos</h1>
        <p className="text-sm text-neutral-500">
          Feche o pagamento de qualquer funcionário direto por aqui, sem precisar entrar no
          cadastro de cada um.
        </p>
      </div>

      <Card
        className={
          isOverdue ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"
        }
      >
        <CardContent className="py-4">
          <p className="text-sm">
            <span className="font-semibold">Fechamento da folha de {prevMonthLabel}</span> — os
            vales e horas desse mês somam do dia 1 ao último dia, e o pagamento deve sair até o
            5º dia útil deste mês:{" "}
            <span className={isOverdue ? "font-semibold text-destructive" : "font-semibold"}>
              {deadline.toLocaleDateString("pt-BR")}
            </span>
            {isOverdue && " — esse prazo já passou!"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Adiantamento do dia 20</CardTitle>
          <GenerateAdvancesButton />
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthAdvances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-neutral-500">
                      Nenhum adiantamento gerado este mês ainda.
                    </TableCell>
                  </TableRow>
                )}
                {monthAdvances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-medium">{advance.employee.name}</TableCell>
                    <TableCell className="text-neutral-500">
                      {advance.date.toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>{currency(Number(advance.amount))}</TableCell>
                    <TableCell>
                      {advance.paymentId ? (
                        <Badge variant="secondary">Descontado</Badge>
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            40% do salário bruto de cada funcionário ativo, lançado como vale no dia 20. Entra
            automaticamente como desconto quando você fechar o pagamento do mês.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          A pagar — folha de {prevMonthLabel}
          {employeesToPay.length > 0 && (
            <Badge variant={isOverdue ? "destructive" : "outline"}>{employeesToPay.length}</Badge>
          )}
        </h2>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Salário base</TableHead>
                <TableHead>Adiantamento pendente</TableHead>
                <TableHead>Outros vales pendentes</TableHead>
                <TableHead>Último pagamento</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesToPay.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-neutral-500">
                    Todo mundo já está com a folha de {prevMonthLabel} fechada. 🎉
                  </TableCell>
                </TableRow>
              )}
              {employeesToPay.map((employee) => {
                const lastPayment = lastPaymentByEmployee.get(employee.id);
                const pendingAdiantamento = pendingAdiantamentoByEmployee.get(employee.id) ?? 0;
                const pendingOutrosVales = pendingOutrosValesByEmployee.get(employee.id) ?? 0;
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      <Link href={`/funcionarios/${employee.id}`} className="hover:underline">
                        {employee.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-neutral-500">{employee.role ?? "—"}</TableCell>
                    <TableCell>{currency(Number(employee.baseSalary))}</TableCell>
                    <TableCell
                      className={pendingAdiantamento > 0 ? "text-destructive" : "text-neutral-500"}
                    >
                      {pendingAdiantamento > 0 ? currency(pendingAdiantamento) : "—"}
                    </TableCell>
                    <TableCell
                      className={pendingOutrosVales > 0 ? "text-destructive" : "text-neutral-500"}
                    >
                      {pendingOutrosVales > 0 ? currency(pendingOutrosVales) : "—"}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {lastPayment
                        ? lastPayment.periodEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ClosePaymentDialog
                        employeeId={employee.id}
                        employeeName={employee.name}
                        baseSalary={Number(employee.baseSalary)}
                        dependents={employee.dependents}
                        cltSettings={cltSettings}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          Pagos — folha de {prevMonthLabel}
          {employeesPaid.length > 0 && <Badge variant="secondary">{employeesPaid.length}</Badge>}
        </h2>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Período pago</TableHead>
                <TableHead>Valor líquido</TableHead>
                <TableHead>Fechado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesPaid.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-neutral-500">
                    Ninguém ainda com a folha de {prevMonthLabel} fechada.
                  </TableCell>
                </TableRow>
              )}
              {employeesPaid.map((employee) => {
                const lastPayment = lastPaymentByEmployee.get(employee.id);
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      <Link href={`/funcionarios/${employee.id}`} className="hover:underline">
                        {employee.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-neutral-500">{employee.role ?? "—"}</TableCell>
                    <TableCell className="text-neutral-500">
                      {lastPayment &&
                        `${lastPayment.periodStart.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${lastPayment.periodEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {lastPayment && currency(Number(lastPayment.netAmount))}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {lastPayment && lastPayment.paidAt.toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Histórico de pagamentos por mês</h2>
        {monthGroups.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum pagamento fechado ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {monthGroups.map((group, index) => (
              <PaymentMonthSection
                key={group.key}
                monthLabel={group.label}
                payments={group.payments}
                totalNet={group.totalNet}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
