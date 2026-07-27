import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MovementForm } from "./movement-form";

export default async function MovimentacoesPage() {
  await requirePermission("canManageEstoque");

  const [ingredients, movements] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { ingredient: true, user: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Movimentações</h1>
        <p className="text-sm text-neutral-500">Lance entradas e saídas manuais de insumos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <MovementForm ingredients={ingredients} />

        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-neutral-500">
                    Nenhuma movimentação registrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{movement.createdAt.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="font-medium">{movement.ingredient.name}</TableCell>
                  <TableCell>
                    {movement.type === "ENTRADA" ? (
                      <Badge variant="secondary">Entrada</Badge>
                    ) : (
                      <Badge variant="destructive">Saída</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {movement.quantity.toString()} {movement.ingredient.unit}
                  </TableCell>
                  <TableCell>{movement.user.name}</TableCell>
                  <TableCell className="text-neutral-500">{movement.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
