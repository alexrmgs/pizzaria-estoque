import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ValeForm } from "./vale-form";
import { DeleteValeButton } from "./delete-vale-button";
import { GenerateAdvancesButton } from "./generate-advances-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function ValesPage() {
  await requirePermission("canManageFuncionarios");

  const [employees, advances] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.advance.findMany({
      orderBy: { date: "desc" },
      take: 100,
      include: { employee: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vales</h1>
          <p className="text-sm text-neutral-500">
            Lançamento rápido de vales para qualquer funcionário.
          </p>
        </div>
        <GenerateAdvancesButton />
      </div>

      <ValeForm employees={employees.map((e) => ({ id: e.id, name: e.name }))} />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Nenhum vale lançado ainda.
                </TableCell>
              </TableRow>
            )}
            {advances.map((advance) => (
              <TableRow key={advance.id}>
                <TableCell className="font-medium">{advance.employee.name}</TableCell>
                <TableCell>{advance.date.toISOString().slice(0, 10)}</TableCell>
                <TableCell>{currency(Number(advance.amount))}</TableCell>
                <TableCell className="text-neutral-500">{advance.description ?? "—"}</TableCell>
                <TableCell>
                  {advance.paymentId ? (
                    <Badge variant="secondary">Pago</Badge>
                  ) : (
                    <Badge variant="destructive">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!advance.paymentId && <DeleteValeButton id={advance.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
