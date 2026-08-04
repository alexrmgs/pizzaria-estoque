import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeDialog } from "./recipe-dialog";
import { DeleteRecipeButton } from "./delete-recipe-button";
import { DuplicateRecipeButton } from "./duplicate-recipe-button";
import { MoveRecipeButtons } from "./move-recipe-buttons";
import { recipeItemCost, RECIPE_TYPE_LABELS, formatRecipeQuantity } from "@/lib/recipe-cost";
import type { Prisma, RecipeType } from "@/lib/generated/prisma/client";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const UNIT_YIELD_TYPES: RecipeType[] = ["PIZZA", "BEIRUTE", "ESFIHA"];

type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { ingredients: { include: { ingredient: true } } };
}>;

type RecipeIngredientOption = {
  id: string;
  name: string;
  unit: string;
  recipeUnit: string | null;
  unitsPerPackage: string;
  unitPrice: string;
  correctionGrossWeight: string | null;
  correctionNetWeight: string | null;
};

function RecipeGrid({
  recipes,
  ingredients,
  canManage,
  canManageEstoque,
}: {
  recipes: RecipeWithIngredients[];
  ingredients: RecipeIngredientOption[];
  canManage: boolean;
  canManageEstoque: boolean;
}) {
  if (recipes.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhuma receita cadastrada nessa categoria ainda.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe, index) => {
        const totalCost = recipe.ingredients.reduce(
          (sum, item) =>
            sum +
            recipeItemCost(
              Number(item.quantity),
              Number(item.wastePercent),
              Number(item.ingredient.unitPrice),
              Number(item.ingredient.unitsPerPackage),
            ),
          0,
        );
        const isUnitYield = UNIT_YIELD_TYPES.includes(recipe.type);
        const yieldKg = recipe.yieldKg !== null ? Number(recipe.yieldKg) : null;
        const costPerKg = yieldKg && yieldKg > 0 ? totalCost / yieldKg : null;
        const yieldUnits = recipe.yieldUnits ?? null;
        const costPerUnit = yieldUnits && yieldUnits > 0 ? totalCost / yieldUnits : null;

        return (
          <Card key={recipe.id}>
            <CardHeader>
              <div className="flex items-start gap-3">
                {recipe.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.name}
                    className="h-14 w-14 shrink-0 rounded-lg border object-cover"
                  />
                )}
                <div>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {recipe.name}
                  </CardTitle>
                  {recipe.description && (
                    <p className="text-sm text-neutral-500">{recipe.description}</p>
                  )}
                </div>
              </div>
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
                      {formatRecipeQuantity(
                        Number(item.quantity),
                        item.ingredient.recipeUnit ?? item.ingredient.unit,
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-col gap-0.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Custo total (com perdas)</span>
                  <span className="font-medium">{currency(totalCost)}</span>
                </div>
                {isUnitYield ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Rendimento</span>
                      <span className="font-medium">
                        {yieldUnits !== null ? `${yieldUnits} un.` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Custo por unidade</span>
                      <span className="font-medium">
                        {costPerUnit !== null ? currency(costPerUnit) : "—"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                    <MoveRecipeButtons
                      id={recipe.id}
                      disableUp={index === 0}
                      disableDown={index === recipes.length - 1}
                    />
                    <RecipeDialog
                      ingredients={ingredients}
                      canManageEstoque={canManageEstoque}
                      recipe={{
                        id: recipe.id,
                        name: recipe.name,
                        type: recipe.type,
                        description: recipe.description,
                        instructions: recipe.instructions,
                        imageUrl: recipe.imageUrl,
                        yieldKg: recipe.yieldKg?.toString() ?? null,
                        yieldUnits: recipe.yieldUnits ?? null,
                        ingredients: recipe.ingredients.map((item) => ({
                          ingredientId: item.ingredientId,
                          quantity: item.quantity.toString(),
                          wastePercent: item.wastePercent.toString(),
                        })),
                      }}
                    />
                    <DuplicateRecipeButton id={recipe.id} />
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
  const canManageEstoque = user.role.canManageEstoque;

  const [recipes, ingredients] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        ingredients: { include: { ingredient: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        recipeUnit: true,
        unitsPerPackage: true,
        unitPrice: true,
        correctionGrossWeight: true,
        correctionNetWeight: true,
      },
    }),
  ]);
  const ingredientOptions: RecipeIngredientOption[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    recipeUnit: i.recipeUnit,
    correctionGrossWeight: i.correctionGrossWeight?.toString() ?? null,
    correctionNetWeight: i.correctionNetWeight?.toString() ?? null,
    unitsPerPackage: i.unitsPerPackage.toString(),
    unitPrice: i.unitPrice.toString(),
  }));

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
        {canManage && (
          <RecipeDialog ingredients={ingredientOptions} canManageEstoque={canManageEstoque} />
        )}
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
              <RecipeDialog
                ingredients={ingredientOptions}
                canManageEstoque={canManageEstoque}
                defaultType="PRODUCAO"
              />
            </div>
          )}
          <RecipeGrid
            recipes={byType.PRODUCAO}
            ingredients={ingredientOptions}
            canManage={canManage}
            canManageEstoque={canManageEstoque}
          />
        </TabsContent>

        <TabsContent value="PIZZA" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog
                ingredients={ingredientOptions}
                canManageEstoque={canManageEstoque}
                defaultType="PIZZA"
              />
            </div>
          )}
          <RecipeGrid
            recipes={byType.PIZZA}
            ingredients={ingredientOptions}
            canManage={canManage}
            canManageEstoque={canManageEstoque}
          />
        </TabsContent>

        <TabsContent value="BEIRUTE" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog
                ingredients={ingredientOptions}
                canManageEstoque={canManageEstoque}
                defaultType="BEIRUTE"
              />
            </div>
          )}
          <RecipeGrid
            recipes={byType.BEIRUTE}
            ingredients={ingredientOptions}
            canManage={canManage}
            canManageEstoque={canManageEstoque}
          />
        </TabsContent>

        <TabsContent value="ESFIHA" className="flex flex-col gap-4 pt-4">
          {canManage && (
            <div>
              <RecipeDialog
                ingredients={ingredientOptions}
                canManageEstoque={canManageEstoque}
                defaultType="ESFIHA"
              />
            </div>
          )}
          <RecipeGrid
            recipes={byType.ESFIHA}
            ingredients={ingredientOptions}
            canManage={canManage}
            canManageEstoque={canManageEstoque}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
