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
import { Button } from "@/components/ui/button";
import type { Prisma } from "@/lib/generated/prisma/client";

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canViewRelatorios");
  const params = await searchParams;

  const ingredientId = typeof params.ingredientId === "string" ? params.ingredientId : undefined;
  const userId = typeof params.userId === "string" ? params.userId : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;

  const where: Prisma.StockMovementWhereInput = {};
  if (ingredientId) where.ingredientId = ingredientId;
  if (userId) where.userId = userId;
  if (type === "ENTRADA" || type === "SAIDA") where.type = type;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    };
  }

  const [movements, ingredients, users] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { ingredient: true, user: true },
      take: 200,
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalEntradas = movements
    .filter((m) => m.type === "ENTRADA")
    .reduce((sum, m) => sum + Number(m.quantity), 0);
  const totalSaidas = movements
    .filter((m) => m.type === "SAIDA")
    .reduce((sum, m) => sum + Number(m.quantity), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-neutral-500">Histórico de movimentações de estoque.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="from">De</label>
          <input id="from" name="from" type="date" defaultValue={from} className={selectClassName} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="to">Até</label>
          <input id="to" name="to" type="date" defaultValue={to} className={selectClassName} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="ingredientId">Ingrediente</label>
          <select id="ingredientId" name="ingredientId" defaultValue={ingredientId ?? ""} className={selectClassName}>
            <option value="">Todos</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="type">Tipo</label>
          <select id="type" name="type" defaultValue={type ?? ""} className={selectClassName}>
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="userId">Funcionário</label>
          <select id="userId" name="userId" defaultValue={userId ?? ""} className={selectClassName}>
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">Filtrar</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/relatorios" />}>
          Limpar
        </Button>
      </form>

      <div className="flex gap-4 text-sm">
        <p>
          Total de entradas: <span className="font-medium">{totalEntradas}</span>
        </p>
        <p>
          Total de saídas: <span className="font-medium">{totalSaidas}</span>
        </p>
        <p className="text-neutral-500">{movements.length} movimentações encontradas</p>
      </div>

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
                  Nenhuma movimentação encontrada para os filtros selecionados.
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
  );
}
