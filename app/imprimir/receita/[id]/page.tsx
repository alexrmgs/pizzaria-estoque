import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { PrintButton } from "@/components/print-button";
import { RECIPE_TYPE_LABELS, formatRecipeQuantity } from "@/lib/recipe-cost";

export default async function ImprimirReceitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("canManageReceitas");
  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: { include: { ingredient: true } } },
  });

  if (!recipe) notFound();

  const yieldKg = recipe.yieldKg !== null ? Number(recipe.yieldKg) : null;
  // Só faz sentido escalar "por 1kg" pra fichas de produção (massa, molho,
  // recheio...) que rendem em quilos — pizza/beirute/esfiha rendem em
  // unidades, não em peso.
  const showPerKg = recipe.type === "PRODUCAO" && yieldKg !== null && yieldKg > 0;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Ficha técnica para impressão</p>
        <PrintButton />
      </div>

      <div className="flex items-center gap-3 border-b border-dashed pb-4">
        <Image src="/logo.png" alt="FB Pizzaria & Esfiharia" width={48} height={47} />
        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            FB Pizzaria &amp; Esfiharia · {RECIPE_TYPE_LABELS[recipe.type]}
          </p>
          <h1 className="text-2xl font-bold">{recipe.name}</h1>
        </div>
      </div>
      {recipe.description && <p className="-mt-2 text-neutral-600">{recipe.description}</p>}

      {recipe.imageUrl && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Como deve ficar pronto</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.imageUrl}
            alt={`Referência de ${recipe.name} pronto`}
            className="max-h-80 w-full rounded-lg border object-cover"
          />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Ingredientes</h2>
        {showPerKg && (
          <p className="-mt-1 mb-2 text-xs text-neutral-500">
            Rendimento da receita: {yieldKg!.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg. A
            coluna &quot;por 1kg&quot; ajuda a escalar pra qualquer tamanho de produção.
          </p>
        )}
        {showPerKg && (
          <div className="flex justify-between border-b py-1 text-xs font-semibold text-neutral-500">
            <span>Ingrediente</span>
            <span className="flex gap-4">
              <span className="w-20 text-right">Total</span>
              <span className="w-20 text-right">Por 1kg</span>
            </span>
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {recipe.ingredients.map((item) => {
            const quantity = Number(item.quantity);
            const unit = item.ingredient.recipeUnit ?? item.ingredient.unit;
            return (
              <li key={item.id} className="flex justify-between border-b border-dashed py-1 text-sm">
                <span>
                  {item.ingredient.name}
                  {Number(item.wastePercent) > 0 && (
                    <span className="text-neutral-500"> ({Number(item.wastePercent)}% perda)</span>
                  )}
                </span>
                {showPerKg ? (
                  <span className="flex gap-4">
                    <span className="w-20 text-right">{formatRecipeQuantity(quantity, unit)}</span>
                    <span className="w-20 text-right text-neutral-500">
                      {formatRecipeQuantity(quantity / yieldKg!, unit)}
                    </span>
                  </span>
                ) : (
                  <span>{formatRecipeQuantity(quantity, unit)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {recipe.instructions && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Modo de preparo</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{recipe.instructions}</p>
        </div>
      )}
    </div>
  );
}
