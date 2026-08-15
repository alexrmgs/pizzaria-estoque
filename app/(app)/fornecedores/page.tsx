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

  const [fornecedores, entradaMovements, notas] = await Promise.all([
    prisma.fornecedor.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: { type: "ENTRADA", supplierId: { not: null } },
      select: { supplierId: true, quantity: true, unitPriceAtEntry: true },
    }),
    prisma.notaFiscal.findMany({
      where: { fornecedor: { not: null } },
      select: { fornecedor: true, total: true },
    }),
  ]);

  const totalByFornecedorId = new Map<string, number>();
  for (const m of entradaMovements) {
    if (!m.supplierId) continue;
    const valor = Number(m.quantity) * Number(m.unitPriceAtEntry ?? 0);
    totalByFornecedorId.set(m.supplierId, (totalByFornecedorId.get(m.supplierId) ?? 0) + valor);
  }

  const rankingMovimentacoes = fornecedores
    .map((f) => ({ id: f.id, name: f.name, total: totalByFornecedorId.get(f.id) ?? 0 }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalByNotaFornecedor = new Map<string, { total: number; count: number }>();
  for (const n of notas) {
    const nome = n.fornecedor!.trim();
    if (!nome) continue;
    const atual = totalByNotaFornecedor.get(nome) ?? { total: 0, count: 0 };
    atual.total += Number(n.total);
    atual.count += 1;
    totalByNotaFornecedor.set(nome, atual);
  }
  const rankingNotas = [...totalByNotaFornecedor.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Fornecedores</h1>
          <p className="text-sm text-neutral-500">
            Cadastre fornecedores e acompanhe onde mais se compra.
          </p>
        </div>
        <FornecedorDialog />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💰 Onde mais compro — entradas manuais</CardTitle>
            <p className="text-xs text-neutral-500">
              Soma das entradas em Movimentações marcadas com fornecedor.
            </p>
          </CardHeader>
          <CardContent>
            {rankingMovimentacoes.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nenhuma entrada com fornecedor marcado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {rankingMovimentacoes.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className="font-semibold text-primary">{currency(f.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🧾 Onde mais compro — notas fiscais (NF-e)</CardTitle>
            <p className="text-xs text-neutral-500">
              Somado pelo nome do emitente das notas importadas em Notas de Entrada.
            </p>
          </CardHeader>
          <CardContent>
            {rankingNotas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma nota fiscal com fornecedor ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rankingNotas.map((f) => (
                  <div key={f.nome} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{f.nome}</span>
                    <span className="text-neutral-500">
                      {f.count} {f.count === 1 ? "nota" : "notas"} ·{" "}
                      <span className="font-semibold text-primary">{currency(f.total)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
              <TableHead>Observação</TableHead>
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
                <TableCell className="text-neutral-500">{f.note ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <FornecedorDialog fornecedor={f} />
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
