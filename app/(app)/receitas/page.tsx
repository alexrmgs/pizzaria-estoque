import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecipeDialog } from "./recipe-dialog";
import { DeleteRecipeButton } from "./delete-recipe-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function ReceitasPage() {
  const user = await requirePermission("canManageReceitas");

  const [recipes, ingredients] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { name: "asc" },
      include: { ingredients: { include: { ingredient: true } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Receitas (Fichas Técnicas)</h1>
          <p className="text-sm text-neutral-500">
            Referência dos ingredientes de cada pizza. Não afeta o estoque.
          </p>
        </div>
        {user.role.canManageReceitas && <RecipeDialog ingredients={ingredients} />}
      </div>

      {recipes.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma receita cadastrada ainda.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => {
          const totalCost = recipe.ingredients.reduce(
            (sum, item) => sum + Number(item.quantity) * Number(item.ingredient.unitPrice),
            0,
          );
          const yieldKg = recipe.yieldKg !== null ? Number(recipe.yieldKg) : null;
          const costPerKg = yieldKg && yieldKg > 0 ? totalCost / yieldKg : null;

          return (
            <Card key={recipe.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {recipe.name}
                </CardTitle>
                {recipe.description && (
                  <p className="text-sm text-neutral-500">{recipe.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {recipe.ingredients.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.ingredient.name}</span>
                      <span className="text-neutral-500">
                        {item.quantity.toString()} {item.ingredient.unit}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-col gap-0.5 border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Custo total</span>
                    <span className="font-medium">{currency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Rendimento real</span>
                    <span className="font-medium">
                      {yieldKg !== null ? `${yieldKg.toFixed(3)} kg` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Custo por kg</span>
                    <span className="font-medium">
                      {costPerKg !== null ? `${currency(costPerKg)}/kg` : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link href={`/imprimir/receita/${recipe.id}`} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    Imprimir
                  </Button>
                  {user.role.canManageReceitas && (
                    <>
                      <RecipeDialog
                        ingredients={ingredients}
                        recipe={{
                          id: recipe.id,
                          name: recipe.name,
                          description: recipe.description,
                          instructions: recipe.instructions,
                          yieldKg: recipe.yieldKg?.toString() ?? null,
                          ingredients: recipe.ingredients.map((item) => ({
                            ingredientId: item.ingredientId,
                            quantity: item.quantity.toString(),
                          })),
                        }}
                      />
                      <DeleteRecipeButton id={recipe.id} name={recipe.name} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
