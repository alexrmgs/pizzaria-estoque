import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { ConferenceForm } from "./conference-form";

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function ConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canManageEstoque");
  const params = await searchParams;
  const categoryId = typeof params.categoria === "string" ? params.categoria : undefined;

  const [ingredients, categories] = await Promise.all([
    prisma.ingredient.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Conferência de Estoque</h1>
        <p className="text-sm text-neutral-500">
          Digite a quantidade que você contou fisicamente. Só os itens com diferença geram
          ajuste — o sistema atualiza o estoque e registra o motivo automaticamente.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={categoryId ?? ""}
            className={selectClassName}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/conferencia" />}>
          Limpar
        </Button>
      </form>

      <ConferenceForm
        ingredients={ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          currentStock: ingredient.currentStock.toString(),
          categoryName: ingredient.category?.name ?? null,
        }))}
      />
    </div>
  );
}
