import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { ProdutosEditor } from "./editor";

export default async function ProdutosMaePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  const companyId = store!.companyId;
  const [categorias, produtos, comFoto, receitas] = await Promise.all([
    prisma.pdvProdutoCategoria.findMany({ where: { companyId }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    // sem fotoUrl: foto pesa; o formulário busca a foto quando abre o produto
    prisma.pdvProdutoMae.findMany({
      where: { companyId },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoriaId: true,
        descricao: true,
        ativo: true,
        variacoes: { where: { ativo: true }, orderBy: { ordem: "asc" }, include: { recipe: { select: { name: true } } } },
      },
    }),
    prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "PdvProdutoMae" WHERE "companyId" = ${companyId} AND "fotoUrl" IS NOT NULL`,
    prisma.recipe.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const temFoto = new Set(comFoto.map((r) => r.id));

  return (
    <ProdutosEditor
      storeId={store!.id}
      categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
      receitas={receitas.map((r) => ({ id: r.id, nome: r.name }))}
      produtos={produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoriaId: p.categoriaId,
        descricao: p.descricao ?? "",
        temFoto: temFoto.has(p.id),
        ativo: p.ativo,
        variacoes: p.variacoes.map((v) => ({
          id: v.id,
          nome: v.nome,
          recipeId: v.recipeId,
          receitaNome: v.recipe?.name ?? null,
          precoReferencia: v.precoReferencia != null ? Number(v.precoReferencia) : null,
        })),
      }))}
    />
  );
}
