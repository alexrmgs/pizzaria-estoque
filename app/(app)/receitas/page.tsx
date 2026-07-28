import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeDialog } from "./recipe-dialog";
import { DeleteRecipeButton } from "./delete-recipe-button";
import { recipeItemCost, RECIPE_TYPE_LABELS } from "@/lib/recipe-cost";
import type { Prisma } from "@/lib/generated/prisma/client";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { ingredients: { include: { ingredient: true } } };
}>;

function RecipeGrid({
  recipes,
  ingredients,
  canManage,
}: {
  recipes: RecipeWithIngredients[];
  ingredients: { id: string; name: string; unit: string }[];
  canManage: boolean;
}) {
  if (recipes.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhuma receita cadastrada nessa categoria ainda.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => {
        const totalCost = recipe.ingredients.reduce(
          (sum, item) =>
            sum +
            recipeItemCost(
              Number(item.quantity),
              Number(item.wastePercent),
              Number(item.ingredient.unitPrice),
            ),
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
                    <span>
                      {item.ingredient.name}
                      {Number(item.wastePercent) > 0 && (
                        <span className="text-neutral-400"> ({Number(item.wastePercent)}% perda)</span>
                      )}
                    </span>
                    <span className="text-neutral-500">
                      {item.quantity.toString()} {item.ingredient.unit}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-col gap-0.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Custo total (com perdas)</span>
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
                {canManage && (
                  <>
                    <RecipeDialog
                      ingredients={ingredients}
                      recipe={{
                        id: recipe.id,
                        name: recipe.name,
                        type: recipe.type,
                        description: recipe.description,
                        instructions: recipe.instructions,
                        yieldKg: recipe.yieldKg?.toString() ?? null,
                        ingredients: recipe.ingredients.map((item) => ({
                          ingredientId: item.ingredientId,
                          quantity: item.quantity.toString(),
                          wastePercent: item.wastePercent.toString(),
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
  );
}

export default async function ReceitasPage() {
  const user = await requirePermission("canManageReceitas");
  const canManage = user.role.canManageReceitas;

  const [recipes, ingredients] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { name: "asc" },
      include: { ingredients: { include: { ingredient: true } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);

  const byType = {
    PRODUCAO: recipes.filter((r) => r.type === "PRODUCAO"),
    PIZZA: recipes.filter((r) => r.type === "PIZZA"),
    BEIRUTE: recipes.filter((r) => r.type === "BEIRUTE"),
    ESFIHA: recipes.filter((r) => r.type === "ESFIHA"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Receitas (Fichas Técnicas)</h1>
          <p className="text-sm text-neutral-500">
            Referência dos ingredientes de cada preparo. Não afeta o estoque.
          </p>
        </div>
        {canManage && <RecipeDialog ingredients={ingredients} />}
      </div>

      <Tabs defaultValue="PRODUCAO">
        <TabsList>
          <TabsTrigger value="PRODUCAO">{RECIPE_TYPE_LABELS.PRODUCAO}</TabsTrigger>
          <TabsTrigger value="PIZZA">Pizzas</TabsTrigger>
          <TabsTrigger value="BEIRUTE">Beirutes</TabsTrigger>
          <TabsTrigger value="ESFIHA">Esfihas</TabsTrigger>
        </TabsList>

        <TabsContent value="PRODUCAO" className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-neutral-500">
            Fichas de preparo base: massa, molho, carnes, recheios... tudo que você produz antes
            de montar o produto final.
          </p>
          {canManage && (
            <div>
              <RecipeDialog ingredients={ingredients} defaultType="PRODUCAO" />
            </div>
          )}
          <RecipeGrid recipes={byType.PRODUCAO} ingredients={ingredients} canManage={canManage} />
        </TabsContent>

        <TabsContent value="PIZZA" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog ingredients={ingredients} defaultType="PIZZA" />
            </div>
          )}
          <RecipeGrid recipes={byType.PIZZA} ingredients={ingredients} canManage={canManage} />
        </TabsContent>

        <TabsContent value="BEIRUTE" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog ingredients={ingredients} defaultType="BEIRUTE" />
            </div>
          )}
          <RecipeGrid recipes={byType.BEIRUTE} ingredients={ingredients} canManage={canManage} />
        </TabsContent>

        <TabsContent value="ESFIHA" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog ingredients={ingredients} defaultType="ESFIHA" />
            </div>
          )}
          <RecipeGrid recipes={byType.ESFIHA} ingredients={ingredients} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
