import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IngredientDialog } from "./ingredient-dialog";
import { DeleteIngredientButton } from "./delete-ingredient-button";
import { ExcludeProducedFromCmvButton } from "./exclude-produced-from-cmv-button";
import type { Prisma } from "@/lib/generated/prisma/client";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type IngredientWithCategory = Prisma.IngredientGetPayload<{ include: { category: true } }>;
type Category = { id: string; name: string };

function IngredientsTable({
  ingredients,
  categories,
  canManage,
  emptyMessage,
}: {
  ingredients: IngredientWithCategory[];
  categories: Category[];
  canManage: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Preço unit.</TableHead>
            <TableHead>Estoque atual</TableHead>
            <TableHead>Estoque mínimo</TableHead>
            <TableHead>Valor em estoque</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-neutral-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {ingredients.map((ingredient) => {
            const current = Number(ingredient.currentStock);
            const min = Number(ingredient.minStock);
            const price = Number(ingredient.unitPrice);
            const low = current < min;
            return (
              <TableRow key={ingredient.id}>
                <TableCell className="font-medium">{ingredient.name}</TableCell>
                <TableCell className="text-neutral-500">{ingredient.category?.name ?? "—"}</TableCell>
                <TableCell>{ingredient.unit}</TableCell>
                <TableCell>{currency(price)}</TableCell>
                <TableCell>{current}</TableCell>
                <TableCell>{min}</TableCell>
                <TableCell>{currency(current * price)}</TableCell>
                <TableCell>
                  {low ? (
                    <Badge variant="destructive">Estoque baixo</Badge>
                  ) : (
                    <Badge variant="secondary">OK</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <IngredientDialog
                        categories={categories}
                        ingredient={{
                          id: ingredient.id,
                          name: ingredient.name,
                          unit: ingredient.unit,
                          unitPrice: ingredient.unitPrice.toString(),
                          minStock: ingredient.minStock.toString(),
                          idealStock: ingredient.idealStock?.toString() ?? null,
                          includeInCmv: ingredient.includeInCmv,
                          isProduced: ingredient.isProduced,
                          categoryId: ingredient.categoryId,
                          recipeUnit: ingredient.recipeUnit,
                          unitsPerPackage: ingredient.unitsPerPackage.toString(),
                          correctionGrossWeight: ingredient.correctionGrossWeight?.toString() ?? null,
                          correctionNetWeight: ingredient.correctionNetWeight?.toString() ?? null,
                        }}
                      />
                      <DeleteIngredientButton id={ingredient.id} name={ingredient.name} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("canManageEstoque");
  const params = await searchParams;

  const busca = typeof params.busca === "string" ? params.busca.trim() : "";
  const categoryId = typeof params.categoria === "string" ? params.categoria : "";
  const status = typeof params.status === "string" ? params.status : "";

  const where: Prisma.IngredientWhereInput = {};
  if (busca) where.name = { contains: busca, mode: "insensitive" };
  if (categoryId) where.categoryId = categoryId;

  const [ingredientsRaw, categories] = await Promise.all([
    prisma.ingredient.findMany({ where, orderBy: { name: "asc" }, include: { category: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const ingredients = ingredientsRaw.filter((ingredient) => {
    if (!status) return true;
    const low = Number(ingredient.currentStock) < Number(ingredient.minStock);
    return status === "baixo" ? low : !low;
  });

  const normalIngredients = ingredients.filter((i) => !i.isProduced);
  const producedIngredients = ingredients.filter((i) => i.isProduced);

  const valueOf = (list: typeof ingredientsRaw) =>
    list.reduce((sum, ingredient) => sum + Number(ingredient.currentStock) * Number(ingredient.unitPrice), 0);
  const normalTotalValue = valueOf(ingredientsRaw.filter((i) => !i.isProduced));
  const producedTotalValue = valueOf(ingredientsRaw.filter((i) => i.isProduced));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-neutral-500">Ingredientes cadastrados e níveis atuais.</p>
        </div>
        {user.role.canManageEstoque && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/categorias" />}>
              Categorias
            </Button>
            <IngredientDialog categories={categories} />
          </div>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="flex flex-1 flex-col gap-1 sm:min-w-48">
          <label className="text-xs text-neutral-500" htmlFor="busca">
            Buscar
          </label>
          <Input
            id="busca"
            name="busca"
            placeholder="Nome do ingrediente..."
            defaultValue={busca}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={categoryId}
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className={selectClassName}>
            <option value="">Todos</option>
            <option value="baixo">Estoque baixo</option>
            <option value="ok">OK</option>
          </select>
        </div>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/estoque" />}>
          Limpar
        </Button>
      </form>

      <Tabs defaultValue="normal">
        <TabsList>
          <TabsTrigger value="normal">Estoque</TabsTrigger>
          <TabsTrigger value="producao">Estoque de Produção</TabsTrigger>
        </TabsList>

        <TabsContent value="normal" className="flex flex-col gap-4 pt-4">
          <Card className="w-fit">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Valor total do estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">{currency(normalTotalValue)}</p>
            </CardContent>
          </Card>
          <IngredientsTable
            ingredients={normalIngredients}
            categories={categories}
            canManage={user.role.canManageEstoque}
            emptyMessage="Nenhum ingrediente encontrado para os filtros selecionados."
          />
        </TabsContent>

        <TabsContent value="producao" className="flex flex-col gap-4 pt-4">
          <Card className="w-fit">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Valor total do estoque de produção</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">{currency(producedTotalValue)}</p>
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-500">
              Itens marcados como &quot;Produzido internamente&quot; no cadastro — preparados na
              cozinha, não comprados prontos.
            </p>
            {user.role.canManageEstoque && <ExcludeProducedFromCmvButton />}
          </div>
          <IngredientsTable
            ingredients={producedIngredients}
            categories={categories}
            canManage={user.role.canManageEstoque}
            emptyMessage="Nenhum item de produção encontrado para os filtros selecionados."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
