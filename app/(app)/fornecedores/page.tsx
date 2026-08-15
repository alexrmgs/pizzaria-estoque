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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FornecedorDialog } from "./fornecedor-dialog";
import { DeleteFornecedorButton } from "./delete-fornecedor-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FornecedoresPage() {
  await requirePermission("canManageEstoque");

  const [fornecedoresRaw, products, entradaMovements] = await Promise.all([
    prisma.fornecedor.findMany({
      orderBy: { name: "asc" },
      include: { products: { select: { id: true, name: true } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.stockMovement.findMany({
      where: { type: "ENTRADA", supplierId: { not: null } },
      select: { supplierId: true, quantity: true, unitPriceAtEntry: true },
    }),
  ]);

  const fornecedores = fornecedoresRaw.map((f) => ({
    ...f,
    productIds: f.products.map((p) => p.id),
  }));

  const totalByFornecedorId = new Map<string, number>();
  for (const m of entradaMovements) {
    if (!m.supplierId) continue;
    const valor = Number(m.quantity) * Number(m.unitPriceAtEntry ?? 0);
    totalByFornecedorId.set(m.supplierId, (totalByFornecedorId.get(m.supplierId) ?? 0) + valor);
  }

  const ranking = fornecedores
    .map((f) => ({ id: f.id, name: f.name, total: totalByFornecedorId.get(f.id) ?? 0 }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Fornecedores</h1>
          <p className="text-sm text-neutral-500">
            Cadastre fornecedores, os produtos que eles vendem, e acompanhe onde mais se compra.
          </p>
        </div>
        <FornecedorDialog products={products} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 Onde mais compro</CardTitle>
          <p className="text-xs text-neutral-500">
            Soma das entradas em Movimentações marcadas com fornecedor.
          </p>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma entrada com fornecedor marcado ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ranking.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="font-semibold text-primary">{currency(f.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
          Fornecedores cadastrados
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500">
                  Nenhum fornecedor cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {fornecedores.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="text-neutral-500">{f.cnpj ?? "—"}</TableCell>
                <TableCell className="text-neutral-500">{f.phone ?? "—"}</TableCell>
                <TableCell className="text-neutral-500">
                  {f.products.length > 0 ? f.products.map((p) => p.name).join(", ") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <FornecedorDialog fornecedor={f} products={products} />
                    <DeleteFornecedorButton id={f.id} name={f.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
