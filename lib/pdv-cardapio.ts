import { prisma } from "@/lib/prisma";

export { precoMontavel, TIPOS_PRODUTO, DIAS_SEMANA } from "@/lib/pdv-cardapio-preco";

// Leitura do cardápio pra venda: que categorias valem agora (dia/horário em
// Fortaleza), o que cada item entrega e, nos montáveis, quais sabores dá pra
// escolher e a que preço.

function agoraFortaleza(d = new Date()) {
  const local = new Date(d.getTime() - 3 * 3600_000); // UTC-3, sem horário de verão
  return { dia: local.getUTCDay(), hhmm: `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}` };
}

/** A categoria aparece agora? (dias vazio = todos; sem horário = o dia todo; aceita virar a meia-noite) */
export function categoriaValeAgora(c: { dias: number[]; horaInicio: string | null; horaFim: string | null }, quando = new Date()) {
  const { dia, hhmm } = agoraFortaleza(quando);
  if (c.dias.length && !c.dias.includes(dia)) return false;
  if (!c.horaInicio || !c.horaFim) return true;
  return c.horaInicio <= c.horaFim ? hhmm >= c.horaInicio && hhmm <= c.horaFim : hhmm >= c.horaInicio || hhmm <= c.horaFim;
}

export type SaborOpcao = { variacaoId: string; nome: string; preco: number };
export type ItemVenda = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  tipo: "SIMPLES" | "COMBO" | "MONTAVEL";
  maxSabores: number;
  regraPreco: string;
  sabores: SaborOpcao[];
};
export type CategoriaVenda = { id: string; nome: string; itens: ItemVenda[] };

/** Cardápio que o PDV da loja usa (o escolhido na loja, senão o primeiro ativo da empresa). */
export async function cardapioDaLoja(storeId: string, companyId: string) {
  const loja = await prisma.store.findUnique({ where: { id: storeId }, select: { pdvCardapioId: true } });
  const where = loja?.pdvCardapioId ? { id: loja.pdvCardapioId, companyId } : { companyId, ativo: true };
  return prisma.pdvCardapio.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      categorias: {
        where: { ativo: true },
        orderBy: { ordem: "asc" },
        include: {
          itens: {
            where: { ativo: true },
            orderBy: [{ ordem: "asc" }, { nome: "asc" }],
            include: { componentes: { include: { variacao: { include: { produtoMae: true } } } } },
          },
        },
      },
    },
  });
}

type CardapioCompleto = NonNullable<Awaited<ReturnType<typeof cardapioDaLoja>>>;

/**
 * Sabores possíveis de um montável: os itens simples do cardápio (em
 * categorias valendo agora) cujo produto é da categoria/tamanho pedidos. Se o mesmo
 * sabor aparece em duas categorias (normal e promo), vale o menor preço.
 */
export function saboresDoMontavel(cardapio: CardapioCompleto, categoriaProdutoId: string | null, variacao: string | null, quando = new Date()): SaborOpcao[] {
  if (!categoriaProdutoId || !variacao) return [];
  const melhor = new Map<string, SaborOpcao>();
  for (const cat of cardapio.categorias) {
    if (!categoriaValeAgora(cat, quando)) continue;
    for (const it of cat.itens) {
      if (it.maxSabores > 1 || it.componentes.length !== 1) continue;
      const v = it.componentes[0].variacao;
      if (v.produtoMae.categoriaId !== categoriaProdutoId || v.nome.toLowerCase() !== variacao.toLowerCase() || !v.produtoMae.ativo) continue;
      const preco = Number(it.preco);
      const atual = melhor.get(v.id);
      if (!atual || preco < atual.preco) melhor.set(v.id, { variacaoId: v.id, nome: v.produtoMae.nome, preco });
    }
  }
  return [...melhor.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function itensParaVenda(cardapio: CardapioCompleto, quando = new Date()): CategoriaVenda[] {
  return cardapio.categorias
    .filter((c) => categoriaValeAgora(c, quando))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      itens: c.itens.map((it) => ({
        id: it.id,
        nome: it.nome,
        descricao: it.descricao,
        preco: Number(it.preco),
        tipo: it.maxSabores > 1 ? ("MONTAVEL" as const) : it.componentes.length > 1 ? ("COMBO" as const) : ("SIMPLES" as const),
        maxSabores: it.maxSabores,
        regraPreco: it.regraPreco,
        sabores: it.maxSabores > 1 ? saboresDoMontavel(cardapio, it.saborCategoriaId, it.saborVariacao, quando) : [],
      })),
    }))
    .filter((c) => c.itens.length > 0);
}
