import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { todayInBrazil } from "@/lib/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MadrugadaForm } from "./madrugada-form";
import { MadrugadaMonthSection } from "./madrugada-month-section";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function MadrugadaPage() {
  const user = await requirePermission("canManageFuncionarios");

  const [employees, settings, payments] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getAppSettings(user.companyId),
    prisma.payrollAdjustment.findMany({
      where: { type: "MADRUGADA" },
      orderBy: { date: "desc" },
      take: 300,
      include: { employee: true },
    }),
  ]);

  type MonthGroup = {
    key: string;
    label: string;
    totalAmount: number;
    pendingAmount: number;
    payments: {
      id: string;
      employeeName: string;
      date: string;
      amount: number;
      description: string | null;
      paymentId: string | null;
    }[];
  };
  const monthGroups: MonthGroup[] = [];
  const monthGroupByKey = new Map<string, MonthGroup>();
  for (const adjustment of payments) {
    const key = `${adjustment.date.getUTCFullYear()}-${String(adjustment.date.getUTCMonth() + 1).padStart(2, "0")}`;
    let group = monthGroupByKey.get(key);
    if (!group) {
      const label = adjustment.date.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key, label, totalAmount: 0, pendingAmount: 0, payments: [] };
      monthGroupByKey.set(key, group);
      monthGroups.push(group);
    }
    const amount = Number(adjustment.amount);
    group.totalAmount += amount;
    if (!adjustment.paymentId) group.pendingAmount += amount;
    group.payments.push({
      id: adjustment.id,
      employeeName: adjustment.employee.name,
      date: adjustment.date.toISOString().slice(0, 10),
      amount,
      description: adjustment.description,
      paymentId: adjustment.paymentId,
    });
  }

  // Resumo rápido: quanto cada funcionário já acumulou no mês corrente (o
  // que ele vai receber a mais na próxima folha), sem precisar abrir o card
  // do mês lá embaixo.
  const today = todayInBrazil();
  const currentMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const summaryByEmployee = new Map<
    string,
    { employeeId: string; name: string; count: number; total: number }
  >();
  for (const adjustment of payments) {
    const key = `${adjustment.date.getUTCFullYear()}-${String(adjustment.date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (key !== currentMonthKey) continue;
    const entry = summaryByEmployee.get(adjustment.employeeId) ?? {
      employeeId: adjustment.employeeId,
      name: adjustment.employee.name,
      count: 0,
      total: 0,
    };
    entry.count += 1;
    entry.total += Number(adjustment.amount);
    summaryByEmployee.set(adjustment.employeeId, entry);
  }
  const summaryRows = [...summaryByEmployee.values()].sort((a, b) => b.total - a.total);
  const currentMonthLabel = today.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Madrugada</h1>
        <p className="text-sm text-neutral-500">
          Toda vez que um funcionário fizer um turno extra de madrugada, lance aqui o dia e o
          valor combinado (já vem preenchido com o valor fixo cadastrado, mas dá pra mudar). Isso
          NÃO tem nada a ver com o adicional noturno automático (que já sai sozinho do ponto
          batido) — é um valor à parte, que soma no salário quando você fechar o pagamento do mês
          desse funcionário, e aparece como uma linha separada no contracheque dele. O funcionário
          também consegue ver os próprios lançamentos em &quot;Meu Ponto → Salário e Vales&quot;.
        </p>
      </div>

      <MadrugadaForm
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        valorFixo={settings.valorFixoMadrugada.toString()}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg capitalize">Resumo de {currentMonthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryRows.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhuma madrugada lançada esse mês ainda.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Madrugadas no mês</TableHead>
                    <TableHead>Total a receber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {currency(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {monthGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pagamento de madrugada lançado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {monthGroups.map((group, index) => (
            <MadrugadaMonthSection
              key={group.key}
              monthLabel={group.label}
              payments={group.payments}
              totalAmount={group.totalAmount}
              pendingAmount={group.pendingAmount}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
