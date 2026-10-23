import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { ProdutosEditor } from "./editor";

export default async function ProdutosMaePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  const [produtos, receitas] = await Promise.all([
    prisma.pdvProdutoMae.findMany({
      where: { companyId: store!.companyId },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
      include: { variacoes: { where: { ativo: true }, orderBy: { ordem: "asc" }, include: { recipe: { select: { name: true } } } } },
    }),
    prisma.recipe.findMany({ select: { id: true, name: true, type: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <ProdutosEditor
      storeId={store!.id}
      receitas={receitas.map((r) => ({ id: r.id, nome: r.name, tipo: r.type }))}
      produtos={produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
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
