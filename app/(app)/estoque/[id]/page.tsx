import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
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

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HISTORY_LIMIT = 200;

export default async function IngredientHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("canManageEstoque");
  const { id } = await params;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!ingredient) notFound();

  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId: id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: { user: { select: { name: true } } },
  });

  const current = Number(ingredient.currentStock);
  const min = Number(ingredient.minStock);
  const low = current < min;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/estoque" className="text-sm text-neutral-500 hover:underline">
          ← Voltar pro estoque
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{ingredient.name}</h1>
          {low && <Badge variant="destructive">Estoque baixo</Badge>}
          {ingredient.isProduced && <Badge variant="secondary">Produzido internamente</Badge>}
        </div>
        <p className="text-sm text-neutral-500">
          {ingredient.category?.name ?? "Sem categoria"} · Unidade: {ingredient.unit}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Estoque atual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {current} {ingredient.unit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Estoque mínimo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {min} {ingredient.unit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Preço cadastrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(Number(ingredient.unitPrice))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Valor em estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">
              {currency(current * Number(ingredient.unitPrice))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Preço de compra</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Funcionário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-500">
                      Nenhuma movimentação registrada pra esse ingrediente ainda.
                    </TableCell>
                  </TableRow>
                )}
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{movement.createdAt.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {movement.type === "ENTRADA" ? (
                        <Badge variant="secondary">Entrada</Badge>
                      ) : (
                        <Badge variant="destructive">Saída</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {movement.type === "ENTRADA" ? "+" : "-"}
                      {movement.quantity.toString()} {ingredient.unit}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {movement.unitPriceAtEntry !== null
                        ? currency(Number(movement.unitPriceAtEntry))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-neutral-500">{movement.reason ?? "—"}</TableCell>
                    <TableCell className="text-neutral-500">{movement.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {movements.length === HISTORY_LIMIT && (
            <p className="mt-2 text-xs text-neutral-500">
              Mostrando as {HISTORY_LIMIT} movimentações mais recentes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
