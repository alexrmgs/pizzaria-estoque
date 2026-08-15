import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrintButton } from "@/components/print-button";
import { WhatsAppShareButton } from "./whatsapp-share-button";
import { PurchaseTable } from "./purchase-table";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { analisarCompras } from "./ai-actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ListItem = {
  id: string;
  name: string;
  unit: string;
  category: { name: string } | null;
  current: number;
  min: number;
  ideal: number | null;
  suggestedQty: number;
  estimatedCost: number;
};

function ListaTable({
  description,
  emptyMessage,
  items,
  printTitle,
}: {
  description: string;
  emptyMessage: string;
  items: ListItem[];
  printTitle: string;
}) {
  const totalEstimatedCost = items.reduce((sum, item) => sum + item.estimatedCost, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">{description}</p>
        {items.length > 0 && (
          <div className="flex gap-2">
            <WhatsAppShareButton
              items={items.map((item) => ({
                name: item.name,
                unit: item.unit,
                suggestedQty: item.suggestedQty,
              }))}
            />
            <PrintButton />
          </div>
        )}
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold uppercase">{printTitle} — FB Pizzaria &amp; Esfiharia</h1>
        <p className="text-sm text-neutral-500">{new Date().toLocaleDateString("pt-BR")}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      ) : (
        <>
          <Card className="w-fit print:hidden">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Custo estimado da compra</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">{currency(totalEstimatedCost)}</p>
            </CardContent>
          </Card>

          <PurchaseTable items={items} />
        </>
      )}
    </div>
  );
}

export default async function ListaComprasPage() {
  await requirePermission("canManageEstoque");

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: { category: true },
  });

  const base = ingredients
    .filter((ingredient) => !ingredient.isProduced)
    .map((ingredient) => {
      const current = Number(ingredient.currentStock);
      const min = Number(ingredient.minStock);
      const ideal = ingredient.idealStock !== null ? Number(ingredient.idealStock) : null;
      const targetAceitavel = ideal !== null && ideal > min ? ideal : min;
      return {
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category,
        unitPrice: Number(ingredient.unitPrice),
        current,
        min,
        ideal,
        targetAceitavel,
      };
    });

  // Lista curta: só quem já furou o estoque mínimo (urgente).
  const abaixoDoMinimo: ListItem[] = base
    .filter((item) => item.current < item.min)
    .map((item) => {
      const suggestedQty = Math.max(item.targetAceitavel - item.current, 0);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        current: item.current,
        min: item.min,
        ideal: item.ideal,
        suggestedQty,
        estimatedCost: suggestedQty * item.unitPrice,
      };
    });

  // Super lista: todo item abaixo do estoque aceitável (cai pro mínimo se não
  // tiver aceitável definido) — mais abrangente, pra repor antes de faltar.
  const abaixoDoAceitavel: ListItem[] = base
    .filter((item) => item.current < item.targetAceitavel)
    .map((item) => {
      const suggestedQty = Math.max(item.targetAceitavel - item.current, 0);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        current: item.current,
        min: item.min,
        ideal: item.ideal,
        suggestedQty,
        estimatedCost: suggestedQty * item.unitPrice,
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold uppercase">Lista de Compras</h1>
        <p className="text-sm text-neutral-500">Duas visões: só o urgente, ou tudo que já vale repor.</p>
      </div>

      <div className="print:hidden">
        <AiAnalysisPanel action={analisarCompras} title="Sugestão de compras (IA)" />
      </div>

      <Tabs defaultValue="minimo" className="print:contents">
        <TabsList className="print:hidden">
          <TabsTrigger value="minimo">Abaixo do mínimo ({abaixoDoMinimo.length})</TabsTrigger>
          <TabsTrigger value="aceitavel">Super lista — abaixo do aceitável ({abaixoDoAceitavel.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="minimo" className="pt-4 print:contents">
          <ListaTable
            description="Ingredientes que já furaram o estoque mínimo — repor com urgência."
            emptyMessage="Nenhum ingrediente abaixo do estoque mínimo no momento. 🎉"
            items={abaixoDoMinimo}
            printTitle="Lista de Compras — Abaixo do Mínimo"
          />
        </TabsContent>

        <TabsContent value="aceitavel" className="pt-4 print:contents">
          <ListaTable
            description="Todo ingrediente abaixo do estoque aceitável — inclui quem ainda não furou o mínimo, mas já vale repor."
            emptyMessage="Nenhum ingrediente abaixo do estoque aceitável no momento. 🎉"
            items={abaixoDoAceitavel}
            printTitle="Lista de Compras — Super Lista"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
