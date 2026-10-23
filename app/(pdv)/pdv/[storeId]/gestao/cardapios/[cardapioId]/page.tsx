import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { CardapioEditor } from "./editor";

export default async function CardapioPage({ params }: { params: Promise<{ storeId: string; cardapioId: string }> }) {
  const { storeId, cardapioId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  const [cardapio, variacoes] = await Promise.all([
    prisma.pdvCardapio.findFirst({
      where: { id: cardapioId, companyId: store!.companyId },
      include: {
        categorias: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            itens: {
              where: { ativo: true },
              orderBy: [{ ordem: "asc" }, { nome: "asc" }],
              include: { componentes: { include: { variacao: { include: { produtoMae: { select: { nome: true } } } } } } },
            },
          },
        },
      },
    }),
    prisma.pdvVariacao.findMany({
      where: { ativo: true, produtoMae: { companyId: store!.companyId, ativo: true } },
      include: { produtoMae: { select: { nome: true, tipo: true } } },
      orderBy: [{ produtoMae: { tipo: "asc" } }, { produtoMae: { nome: "asc" } }, { ordem: "asc" }],
    }),
  ]);
  if (!cardapio) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/pdv/${store!.id}/gestao/cardapios`}
          aria-label="Voltar pros cardápios"
          className="grid size-11 place-items-center rounded-pdv-sm text-pdv-muted outline-none hover:bg-pdv-raised hover:text-pdv-text focus-visible:ring-3 focus-visible:ring-pdv-accent"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-pdv-display text-2xl font-extrabold">{cardapio.nome}</h1>
      </div>
      <CardapioEditor
        storeId={store!.id}
        cardapioId={cardapio.id}
        variacoes={variacoes.map((v) => ({
          id: v.id,
          nome: v.nome,
          produto: v.produtoMae.nome,
          tipo: v.produtoMae.tipo,
          precoReferencia: v.precoReferencia != null ? Number(v.precoReferencia) : null,
        }))}
        categorias={cardapio.categorias.map((c) => ({
          id: c.id,
          nome: c.nome,
          ordem: c.ordem,
          dias: c.dias,
          horaInicio: c.horaInicio,
          horaFim: c.horaFim,
          itens: c.itens.map((it) => ({
            id: it.id,
            nome: it.nome,
            descricao: it.descricao ?? "",
            preco: Number(it.preco),
            ordem: it.ordem,
            tipo: it.maxSabores > 1 ? ("MONTAVEL" as const) : it.componentes.length > 1 ? ("COMBO" as const) : ("SIMPLES" as const),
            componentes: it.componentes.map((k) => ({ variacaoId: k.variacaoId, qtd: Number(k.qtd), rotulo: `${k.variacao.produtoMae.nome} ${k.variacao.nome}` })),
            maxSabores: it.maxSabores,
            saborTipo: it.saborTipo,
            saborVariacao: it.saborVariacao,
            regraPreco: it.regraPreco,
          })),
        }))}
      />
    </div>
  );
}
