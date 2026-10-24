"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requirePdv } from "@/lib/pdv";

// Cadastros da Gestão: produtos mãe (+ variações) e cardápios (categorias e
// itens). Tudo por empresa; só quem gerencia o PDV mexe.

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const dinheiro = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(Math.round(v * 100)).div(100));
const erroUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const primeiroErro = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos";

async function empresa(storeId: string) {
  const { store } = await requirePdv(storeId, "gerenciar");
  return store!;
}

// ───────────── Produtos mãe ─────────────

const produtoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
  categoriaId: z.string().nullable().optional(),
  descricao: z.string().trim().max(500).optional(),
  // data URL de JPEG já reduzido no navegador
  fotoUrl: z.string().max(1_500_000, "Foto muito grande — escolha outra").nullable().optional(),
  ativo: z.boolean().default(true),
  variacoes: z
    .array(
      z.object({
        id: z.string().optional(),
        nome: z.string().trim().min(1, "Variação sem nome").max(30),
        recipeId: z.string().nullable().optional(),
        precoReferencia: z.number().min(0).nullable().optional(),
      })
    )
    .min(1, "Precisa de pelo menos uma variação (ex: G, ou Unidade)"),
});

export type ProdutoInput = z.input<typeof produtoSchema>;

export async function salvarProdutoMae(storeId: string, input: ProdutoInput): Promise<Resultado<{ id: string }>> {
  const store = await empresa(storeId);
  const p = produtoSchema.safeParse(input);
  if (!p.success) return { ok: false, error: primeiroErro(p.error) };
  const v = p.data;
  if (v.fotoUrl && !v.fotoUrl.startsWith("data:image/")) return { ok: false, error: "Foto inválida" };
  if (v.categoriaId && !(await prisma.pdvProdutoCategoria.count({ where: { id: v.categoriaId, companyId: store.companyId } }))) {
    return { ok: false, error: "Categoria inválida" };
  }
  const nomes = v.variacoes.map((x) => x.nome.toLowerCase());
  if (new Set(nomes).size !== nomes.length) return { ok: false, error: "Duas variações com o mesmo nome" };

  const dadosProduto = {
    nome: v.nome,
    categoriaId: v.categoriaId || null,
    descricao: v.descricao || null,
    // undefined = não mexe na foto (a lista não carrega as fotos)
    ...(v.fotoUrl !== undefined ? { fotoUrl: v.fotoUrl || null } : {}),
    ativo: v.ativo,
  };
  try {
    const id = await prisma.$transaction(async (tx) => {
      const mae = v.id
        ? await tx.pdvProdutoMae.update({ where: { id: v.id, companyId: store.companyId }, data: dadosProduto })
        : await tx.pdvProdutoMae.create({ data: { ...dadosProduto, companyId: store.companyId } });

      const atuais = await tx.pdvVariacao.findMany({ where: { produtoMaeId: mae.id } });
      const mantidas = new Set(v.variacoes.map((x) => x.id).filter(Boolean));
      // variação que saiu da lista: apaga se nunca foi usada; senão só desativa
      for (const a of atuais.filter((a) => !mantidas.has(a.id))) {
        const usada = (await tx.pdvCardapioComponente.count({ where: { variacaoId: a.id } })) + (await tx.pdvVendaItemParte.count({ where: { variacaoId: a.id } }));
        if (usada) await tx.pdvVariacao.update({ where: { id: a.id }, data: { ativo: false, nome: `${a.nome} (inativa ${a.id.slice(-4)})` } });
        else await tx.pdvVariacao.delete({ where: { id: a.id } });
      }
      for (const [ordem, x] of v.variacoes.entries()) {
        const data = { nome: x.nome, recipeId: x.recipeId || null, precoReferencia: dinheiro(x.precoReferencia), ordem, ativo: true };
        if (x.id && atuais.some((a) => a.id === x.id)) await tx.pdvVariacao.update({ where: { id: x.id }, data });
        else await tx.pdvVariacao.create({ data: { ...data, produtoMaeId: mae.id } });
      }
      return mae.id;
    });
    revalidatePath(`/pdv/${storeId}/gestao`, "layout");
    return { ok: true, id };
  } catch (e) {
    if (erroUnico(e)) return { ok: false, error: "Já existe um produto com esse nome" };
    throw e;
  }
}

/** Foto de um produto (a lista de produtos não carrega as fotos, que pesam). */
export async function fotoDoProduto(storeId: string, produtoId: string): Promise<string | null> {
  const store = await empresa(storeId);
  const p = await prisma.pdvProdutoMae.findFirst({ where: { id: produtoId, companyId: store.companyId }, select: { fotoUrl: true } });
  return p?.fotoUrl ?? null;
}

// ───────────── Categorias de produto ─────────────

export async function salvarCategoriaProduto(storeId: string, input: { id?: string; nome: string; ordem?: number }): Promise<Resultado> {
  const store = await empresa(storeId);
  const nome = input.nome.trim().slice(0, 40);
  if (nome.length < 2) return { ok: false, error: "Dê um nome à categoria" };
  try {
    if (input.id) {
      await prisma.pdvProdutoCategoria.update({ where: { id: input.id, companyId: store.companyId }, data: { nome, ...(input.ordem != null ? { ordem: input.ordem } : {}) } });
    } else {
      const ultima = await prisma.pdvProdutoCategoria.aggregate({ where: { companyId: store.companyId }, _max: { ordem: true } });
      await prisma.pdvProdutoCategoria.create({ data: { companyId: store.companyId, nome, ordem: input.ordem ?? (ultima._max.ordem ?? -1) + 1 } });
    }
  } catch (e) {
    if (erroUnico(e)) return { ok: false, error: "Já existe uma categoria com esse nome" };
    throw e;
  }
  revalidatePath(`/pdv/${storeId}/gestao`, "layout");
  return { ok: true };
}

/** Exclui a categoria; os produtos dela ficam "sem categoria". */
export async function excluirCategoriaProduto(storeId: string, id: string): Promise<Resultado> {
  const store = await empresa(storeId);
  const { count } = await prisma.pdvProdutoCategoria.deleteMany({ where: { id, companyId: store.companyId } });
  if (!count) return { ok: false, error: "Categoria não encontrada" };
  revalidatePath(`/pdv/${storeId}/gestao`, "layout");
  return { ok: true };
}

// ───────────── Cardápios ─────────────

export async function criarCardapio(storeId: string, nome: string, canal: string): Promise<Resultado<{ id: string }>> {
  const store = await empresa(storeId);
  const n = nome.trim();
  if (n.length < 2) return { ok: false, error: "Dê um nome ao cardápio" };
  try {
    const c = await prisma.pdvCardapio.create({ data: { companyId: store.companyId, nome: n.slice(0, 60), canal: ["PDV", "IFOOD", "CARDAPIOWEB", "OUTRO"].includes(canal) ? canal : "OUTRO" } });
    revalidatePath(`/pdv/${storeId}/gestao/cardapios`);
    return { ok: true, id: c.id };
  } catch (e) {
    if (erroUnico(e)) return { ok: false, error: "Já existe um cardápio com esse nome" };
    throw e;
  }
}

/** Qual cardápio o PDV desta loja usa. */
export async function usarCardapioNaLoja(storeId: string, cardapioId: string): Promise<Resultado> {
  const store = await empresa(storeId);
  const c = await prisma.pdvCardapio.findFirst({ where: { id: cardapioId, companyId: store.companyId } });
  if (!c) return { ok: false, error: "Cardápio não encontrado" };
  await prisma.store.update({ where: { id: store.id }, data: { pdvCardapioId: c.id } });
  revalidatePath(`/pdv/${storeId}`, "layout");
  return { ok: true };
}

async function cardapioDaEmpresa(cardapioId: string, companyId: string) {
  return prisma.pdvCardapio.findFirst({ where: { id: cardapioId, companyId } });
}

const horaRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const categoriaSchema = z.object({
  id: z.string().optional(),
  cardapioId: z.string(),
  nome: z.string().trim().min(2, "Dê um nome à categoria").max(60),
  ordem: z.number().int().min(0).max(999).default(0),
  ativo: z.boolean().default(true),
  dias: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  horaInicio: z.string().regex(horaRe, "Hora no formato 18:00").nullable().optional(),
  horaFim: z.string().regex(horaRe, "Hora no formato 23:59").nullable().optional(),
});

export type CategoriaInput = z.input<typeof categoriaSchema>;

export async function salvarCategoria(storeId: string, input: CategoriaInput): Promise<Resultado> {
  const store = await empresa(storeId);
  const p = categoriaSchema.safeParse(input);
  if (!p.success) return { ok: false, error: primeiroErro(p.error) };
  const v = p.data;
  if (!(await cardapioDaEmpresa(v.cardapioId, store.companyId))) return { ok: false, error: "Cardápio não encontrado" };
  if (!!v.horaInicio !== !!v.horaFim) return { ok: false, error: "Preencha as duas horas, ou nenhuma" };
  const dias = [...new Set(v.dias)].sort();
  const data = { nome: v.nome, ordem: v.ordem, ativo: v.ativo, dias: dias.length === 7 ? [] : dias, horaInicio: v.horaInicio || null, horaFim: v.horaFim || null };
  if (v.id) await prisma.pdvCardapioCategoria.update({ where: { id: v.id, cardapioId: v.cardapioId }, data });
  else await prisma.pdvCardapioCategoria.create({ data: { ...data, cardapioId: v.cardapioId } });
  revalidatePath(`/pdv/${storeId}/gestao/cardapios/${v.cardapioId}`);
  return { ok: true };
}

export async function excluirCategoria(storeId: string, categoriaId: string): Promise<Resultado> {
  const store = await empresa(storeId);
  const cat = await prisma.pdvCardapioCategoria.findFirst({ where: { id: categoriaId, cardapio: { companyId: store.companyId } }, include: { _count: { select: { itens: true } } } });
  if (!cat) return { ok: false, error: "Categoria não encontrada" };
  const vendidos = await prisma.pdvVendaItem.count({ where: { cardapioItem: { categoriaId } } });
  // já vendeu: some do cardápio mas fica no histórico
  if (vendidos) await prisma.pdvCardapioCategoria.update({ where: { id: cat.id }, data: { ativo: false } });
  else await prisma.pdvCardapioCategoria.delete({ where: { id: cat.id } });
  revalidatePath(`/pdv/${storeId}/gestao/cardapios/${cat.cardapioId}`);
  return { ok: true };
}

const itemSchema = z
  .object({
    id: z.string().optional(),
    categoriaId: z.string(),
    nome: z.string().trim().min(2, "Dê um nome ao item").max(80),
    descricao: z.string().trim().max(300).optional(),
    preco: z.number().min(0),
    ordem: z.number().int().min(0).max(999).default(0),
    ativo: z.boolean().default(true),
    tipo: z.enum(["SIMPLES", "COMBO", "MONTAVEL"]),
    componentes: z.array(z.object({ variacaoId: z.string(), qtd: z.number().positive().max(99) })).default([]),
    maxSabores: z.number().int().min(2).max(4).optional(),
    saborCategoriaId: z.string().optional(),
    saborVariacao: z.string().trim().max(30).optional(),
    regraPreco: z.enum(["MAIOR", "MEDIA"]).default("MAIOR"),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "SIMPLES" && v.componentes.length !== 1) ctx.addIssue({ code: "custom", message: "Escolha o produto do item" });
    if (v.tipo === "COMBO" && v.componentes.length < 1) ctx.addIssue({ code: "custom", message: "Combo sem produtos" });
    if (v.tipo === "MONTAVEL" && (!v.maxSabores || !v.saborCategoriaId || !v.saborVariacao)) ctx.addIssue({ code: "custom", message: "Meio a meio: diga a categoria, o tamanho e quantos sabores" });
  });

export type ItemInput = z.input<typeof itemSchema>;

export async function salvarItem(storeId: string, input: ItemInput): Promise<Resultado> {
  const store = await empresa(storeId);
  const p = itemSchema.safeParse(input);
  if (!p.success) return { ok: false, error: primeiroErro(p.error) };
  const v = p.data;
  const cat = await prisma.pdvCardapioCategoria.findFirst({ where: { id: v.categoriaId, cardapio: { companyId: store.companyId } } });
  if (!cat) return { ok: false, error: "Categoria não encontrada" };
  const comps = v.tipo === "MONTAVEL" ? [] : v.componentes;
  if (v.tipo === "MONTAVEL" && !(await prisma.pdvProdutoCategoria.count({ where: { id: v.saborCategoriaId, companyId: store.companyId } }))) {
    return { ok: false, error: "Categoria dos sabores inválida" };
  }
  if (comps.length) {
    const ok = await prisma.pdvVariacao.count({ where: { id: { in: comps.map((c) => c.variacaoId) }, produtoMae: { companyId: store.companyId } } });
    if (ok !== new Set(comps.map((c) => c.variacaoId)).size) return { ok: false, error: "Produto inválido" };
  }
  const data = {
    nome: v.nome,
    descricao: v.descricao || null,
    preco: dinheiro(v.preco)!,
    ordem: v.ordem,
    ativo: v.ativo,
    maxSabores: v.tipo === "MONTAVEL" ? v.maxSabores! : 1,
    saborCategoriaId: v.tipo === "MONTAVEL" ? v.saborCategoriaId! : null,
    saborVariacao: v.tipo === "MONTAVEL" ? v.saborVariacao! : null,
    regraPreco: v.regraPreco,
  };
  await prisma.$transaction(async (tx) => {
    const item = v.id
      ? await tx.pdvCardapioItem.update({ where: { id: v.id, categoria: { cardapioId: cat.cardapioId } }, data: { ...data, categoriaId: cat.id } })
      : await tx.pdvCardapioItem.create({ data: { ...data, categoriaId: cat.id } });
    await tx.pdvCardapioComponente.deleteMany({ where: { itemId: item.id } });
    if (comps.length) {
      await tx.pdvCardapioComponente.createMany({ data: comps.map((c) => ({ itemId: item.id, variacaoId: c.variacaoId, qtd: c.qtd.toFixed(3) })) });
    }
  });
  revalidatePath(`/pdv/${storeId}/gestao/cardapios/${cat.cardapioId}`);
  return { ok: true };
}

export async function excluirItem(storeId: string, itemId: string): Promise<Resultado> {
  const store = await empresa(storeId);
  const it = await prisma.pdvCardapioItem.findFirst({ where: { id: itemId, categoria: { cardapio: { companyId: store.companyId } } }, include: { categoria: true } });
  if (!it) return { ok: false, error: "Item não encontrado" };
  const vendido = await prisma.pdvVendaItem.count({ where: { cardapioItemId: it.id } });
  if (vendido) await prisma.pdvCardapioItem.update({ where: { id: it.id }, data: { ativo: false } });
  else await prisma.pdvCardapioItem.delete({ where: { id: it.id } });
  revalidatePath(`/pdv/${storeId}/gestao/cardapios/${it.categoria.cardapioId}`);
  return { ok: true };
}

/**
 * Atalho de montagem: põe na categoria um item simples pra cada produto mãe
 * da categoria de produto com a variação pedida (ex: todas as Pizzas no G), com o
 * preço de referência. Pula o que já está na categoria.
 */
export async function adicionarTodos(storeId: string, categoriaId: string, categoriaProdutoId: string, variacao: string): Promise<Resultado<{ criados: number }>> {
  const store = await empresa(storeId);
  const cat = await prisma.pdvCardapioCategoria.findFirst({
    where: { id: categoriaId, cardapio: { companyId: store.companyId } },
    include: { itens: { include: { componentes: true } } },
  });
  if (!cat) return { ok: false, error: "Categoria não encontrada" };
  const jaTem = new Set(cat.itens.filter((i) => i.componentes.length === 1).map((i) => i.componentes[0].variacaoId));
  const vars = await prisma.pdvVariacao.findMany({
    where: { ativo: true, nome: { equals: variacao.trim(), mode: "insensitive" }, produtoMae: { companyId: store.companyId, categoriaId: categoriaProdutoId, ativo: true } },
    include: { produtoMae: true },
    orderBy: { produtoMae: { nome: "asc" } },
  });
  const novos = vars.filter((v) => !jaTem.has(v.id));
  let ordem = cat.itens.length;
  for (const v of novos) {
    await prisma.pdvCardapioItem.create({
      data: {
        categoriaId: cat.id,
        nome: `${v.produtoMae.nome}${vars.length && variacao.toLowerCase() !== "padrão" && variacao.toLowerCase() !== "unidade" ? ` ${v.nome}` : ""}`,
        preco: v.precoReferencia ?? 0,
        ordem: ordem++,
        componentes: { create: { variacaoId: v.id } },
      },
    });
  }
  revalidatePath(`/pdv/${storeId}/gestao/cardapios/${cat.cardapioId}`);
  return { ok: true, criados: novos.length };
}
