import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionForm } from "./production-form";

export default async function ProducaoPage() {
  await requirePermission("canManageEstoque");

  const ingredientsRaw = await prisma.ingredient.findMany({
    where: { isProduced: true },
    orderBy: [{ name: "asc" }],
    include: { category: true },
  });

  const ingredients = ingredientsRaw.map((ingredient) => {
    const current = Number(ingredient.currentStock);
    const min = Number(ingredient.minStock);
    const ideal = ingredient.idealStock !== null ? Number(ingredient.idealStock) : null;
    const target = ideal !== null && ideal > min ? ideal : min;
    const suggestion = Math.max(target - current, 0);
    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.currentStock.toString(),
      minStock: ingredient.minStock.toString(),
      idealStock: ingredient.idealStock?.toString() ?? null,
      categoryName: ingredient.category?.name ?? null,
      belowMin: current < min,
      suggestion,
    };
  });

  // Precisam de produção primeiro (mais urgente no topo), depois o resto em ordem alfabética
  const sorted = [...ingredients].sort((a, b) => {
    if (a.belowMin !== b.belowMin) return a.belowMin ? -1 : 1;
    return b.suggestion - a.suggestion;
  });

  const precisamProduzir = ingredients.filter((item) => item.belowMin);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Plano de Produção</h1>
        <p className="text-sm text-neutral-500">
          Itens preparados na cozinha. Registrar aqui só aumenta o estoque do item produzido — o
          desconto dos ingredientes crus continua manual, em Movimentações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Precisa produzir hoje
            {precisamProduzir.length > 0 && (
              <Badge variant="destructive">{precisamProduzir.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {precisamProduzir.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhum item produzido está abaixo do estoque mínimo. 🎉
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {precisamProduzir.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-neutral-500">
                    {item.currentStock} / {item.minStock} {item.unit} · produzir{" "}
                    <span className="font-medium text-primary">
                      {item.suggestion} {item.unit}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ProductionForm items={sorted} />
    </div>
  );
}
