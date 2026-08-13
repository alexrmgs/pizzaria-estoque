import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";
import { WhatsAppShareButton } from "./whatsapp-share-button";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { analisarCompras } from "./ai-actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function ListaComprasPage() {
  await requirePermission("canManageEstoque");

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: { category: true },
  });

  const lowStock = ingredients
    .filter(
      (ingredient) =>
        !ingredient.isProduced && Number(ingredient.currentStock) < Number(ingredient.minStock),
    )
    .map((ingredient) => {
      const current = Number(ingredient.currentStock);
      const min = Number(ingredient.minStock);
      const ideal = ingredient.idealStock !== null ? Number(ingredient.idealStock) : null;
      const target = ideal !== null && ideal > min ? ideal : min;
      const suggestedQty = Math.max(target - current, 0);
      return {
        ...ingredient,
        current,
        min,
        ideal,
        suggestedQty,
        estimatedCost: suggestedQty * Number(ingredient.unitPrice),
      };
    });

  const totalEstimatedCost = lowStock.reduce((sum, item) => sum + item.estimatedCost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Lista de Compras</h1>
          <p className="text-sm text-neutral-500">
            Gerada automaticamente a partir dos ingredientes abaixo do estoque mínimo.
          </p>
        </div>
        {lowStock.length > 0 && (
          <div className="flex gap-2">
            <WhatsAppShareButton
              items={lowStock.map((item) => ({
                name: item.name,
                unit: item.unit,
                suggestedQty: item.suggestedQty,
              }))}
            />
            <PrintButton />
          </div>
        )}
      </div>

      <div className="print:hidden">
        <AiAnalysisPanel action={analisarCompras} title="Sugestão de compras (IA)" />
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold uppercase">Lista de Compras — FB Pizzaria &amp; Esfiharia</h1>
        <p className="text-sm text-neutral-500">{new Date().toLocaleDateString("pt-BR")}</p>
      </div>

      {lowStock.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum ingrediente abaixo do estoque mínimo no momento. 🎉
        </p>
      ) : (
        <>
          <Card className="w-fit print:hidden">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Custo estimado da compra</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">
                {currency(totalEstimatedCost)}
              </p>
            </CardContent>
          </Card>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estoque atual</TableHead>
                  <TableHead>Estoque mínimo</TableHead>
                  <TableHead>Estoque aceitável</TableHead>
                  <TableHead>Sugestão de compra</TableHead>
                  <TableHead className="print:hidden">Custo estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-neutral-500">
                      {item.category?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {item.current} {item.unit}
                    </TableCell>
                    <TableCell>
                      {item.min} {item.unit}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {item.ideal !== null ? `${item.ideal} ${item.unit}` : "não definido"}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {item.suggestedQty} {item.unit}
                    </TableCell>
                    <TableCell className="print:hidden">{currency(item.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-neutral-500 print:hidden">
            Dica: defina o &quot;estoque aceitável&quot; de cada ingrediente na tela de Estoque
            para que a sugestão de compra traga uma quantidade mais precisa (não apenas o mínimo).
          </p>
        </>
      )}
    </div>
  );
}
