import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeDialog } from "./employee-dialog";
import { DismissEmployeeButton } from "./dismiss-employee-button";
import { DeleteEmployeeButton } from "./delete-employee-button";
import { SwapApprovalButtons } from "./swap-approval-buttons";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FuncionariosPage() {
  await requirePermission("canManageFuncionarios");

  const [employees, users, stores, pendingSwaps] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, employee: { select: { id: true } } },
    }),
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shiftSwapRequest.findMany({
      where: { status: "ACEITO_PELO_FUNCIONARIO" },
      orderBy: { targetRespondedAt: "asc" },
      include: { requester: { select: { name: true } }, target: { select: { name: true } } },
    }),
  ]);

  const unlinkedUsers = users.filter((u) => !u.employee);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Funcionários</h1>
          <p className="text-sm text-neutral-500">
            Ponto, vales, bônus/descontos e pagamentos da equipe.
          </p>
        </div>
        <EmployeeDialog availableUsers={unlinkedUsers} stores={stores} />
      </div>

      {pendingSwaps.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Trocas de folga aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingSwaps.map((swap) => (
              <div
                key={swap.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3"
              >
                <p className="text-sm">
                  <span className="font-medium">{swap.requester.name}</span> dá a folga de{" "}
                  <span className="font-medium">
                    {formatDate(swap.requesterDate.toISOString().slice(0, 10))}
                  </span>{" "}
                  e assume a folga de <span className="font-medium">{swap.target.name}</span> em{" "}
                  <span className="font-medium">
                    {formatDate(swap.targetDate.toISOString().slice(0, 10))}
                  </span>
                  {swap.note ? <span className="text-neutral-500"> — &quot;{swap.note}&quot;</span> : ""}
                </p>
                <SwapApprovalButtons swapId={swap.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Salário fixo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Nenhum funcionário cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {employees.map((employee) => {
              const availableForThisEmployee = users
                .filter((u) => !u.employee || u.employee.id === employee.id)
                .map((u) => ({ id: u.id, name: u.name, email: u.email }));

              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    <Link href={`/funcionarios/${employee.id}`} className="hover:underline">
                      {employee.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-neutral-500">{employee.role ?? "—"}</TableCell>
                  <TableCell className="text-neutral-500">{employee.phone ?? "—"}</TableCell>
                  <TableCell>{currency(Number(employee.baseSalary))}</TableCell>
                  <TableCell>
                    {employee.active ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/funcionarios/${employee.id}`} />}
                      >
                        Abrir
                      </Button>
                      <EmployeeDialog
                        availableUsers={availableForThisEmployee}
                        stores={stores}
                        employee={{
                          id: employee.id,
                          name: employee.name,
                          role: employee.role,
                          phone: employee.phone,
                          baseSalary: employee.baseSalary.toString(),
                          dependents: employee.dependents,
                          weeklyDayOff: employee.weeklyDayOff,
                          hireDate: employee.hireDate
                            ? employee.hireDate.toISOString().slice(0, 10)
                            : null,
                          scheduledStart: employee.scheduledStart,
                          scheduledEnd: employee.scheduledEnd,
                          active: employee.active,
                          userId: employee.userId,
                          storeId: employee.storeId,
                        }}
                      />
                      <DismissEmployeeButton
                        id={employee.id}
                        name={employee.name}
                        active={employee.active}
                      />
                      <DeleteEmployeeButton id={employee.id} name={employee.name} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
