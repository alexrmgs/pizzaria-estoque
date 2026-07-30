import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { PrintButton } from "@/components/print-button";
import { RECIPE_TYPE_LABELS } from "@/lib/recipe-cost";

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
        <ul className="flex flex-col gap-1">
          {recipe.ingredients.map((item) => (
            <li key={item.id} className="flex justify-between border-b border-dashed py-1 text-sm">
              <span>
                {item.ingredient.name}
                {Number(item.wastePercent) > 0 && (
                  <span className="text-neutral-500"> ({Number(item.wastePercent)}% perda)</span>
                )}
              </span>
              <span>
                {item.quantity.toString()} {item.ingredient.recipeUnit ?? item.ingredient.unit}
              </span>
            </li>
          ))}
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
