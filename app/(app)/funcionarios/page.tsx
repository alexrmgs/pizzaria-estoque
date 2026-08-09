import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
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
import { attendanceScore, lateMinutes } from "@/lib/payroll";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MEDALS = ["🥇", "🥈", "🥉"];
const FALTA_PENALTY = 15;

export default async function FuncionariosPage() {
  await requirePermission("canManageFuncionarios");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  const [employees, users, stores, settings, rankingEmployees] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, employee: { select: { id: true } } },
    }),
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAppSettings(),
    prisma.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        scheduledStart: true,
        timeEntries: {
          where: { date: { gte: monthStart, lte: monthEnd } },
          select: { clockIn: true },
        },
        dayOffs: {
          where: { date: { gte: monthStart, lte: monthEnd }, type: "FALTA" },
          select: { id: true },
        },
      },
    }),
  ]);

  const unlinkedUsers = users.filter((u) => !u.employee);

  // Ranking do mês: pontualidade (menos atrasos) e assiduidade (menos faltas).
  const ranking = rankingEmployees
    .map((emp) => {
      const dias = emp.timeEntries.length;
      const atrasos = emp.timeEntries.filter(
        (e) => lateMinutes(emp.scheduledStart, e.clockIn) > 0,
      ).length;
      const faltas = emp.dayOffs.length;
      const pontualidade = attendanceScore(atrasos, settings.latePenaltyPoints);
      const score = Math.max(0, Math.round(pontualidade - faltas * FALTA_PENALTY));
      return { id: emp.id, name: emp.name, dias, atrasos, faltas, score };
    })
    .filter((r) => r.dias > 0 || r.faltas > 0)
    .sort((a, b) => b.score - a.score || b.dias - a.dias || a.atrasos - b.atrasos);

  const mesLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg capitalize">🏆 Ranking do mês — {mesLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-neutral-500">
            Baseado na pontualidade (menos atrasos) e assiduidade (menos faltas) no mês.
          </p>
          {ranking.length === 0 ? (
            <p className="text-sm text-neutral-500">Ainda não há dados de ponto neste mês.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Pontuação</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Atrasos</TableHead>
                    <TableHead>Faltas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.id} className={i === 0 ? "bg-amber-50" : undefined}>
                      <TableCell className="font-semibold">{MEDALS[i] ?? `${i + 1}º`}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/funcionarios/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">{r.score}</TableCell>
                      <TableCell className="text-neutral-500">{r.dias}</TableCell>
                      <TableCell className="text-neutral-500">{r.atrasos}</TableCell>
                      <TableCell className="text-neutral-500">{r.faltas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
