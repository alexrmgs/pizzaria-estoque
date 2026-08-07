import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FuncionariosPage() {
  await requirePermission("canManageFuncionarios");

  const [employees, users, stores] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, employee: { select: { id: true } } },
    }),
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const unlinkedUsers = users.filter((u) => !u.employee);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Funcionários</h1>
          <p className="text-sm text-neutral-500">
            Ponto, vales, bônus/descontos e pagamentos da equipe.
          </p>
        </div>
        <EmployeeDialog availableUsers={unlinkedUsers} stores={stores} />
      </div>

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
