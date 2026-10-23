import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import type { Prisma } from "@/lib/generated/prisma/client";

// Data layer do PDV. Toda tela/action do PDV passa por requirePdv, que confere
// a permissão no banco (não na sessão) e se a loja é da empresa do usuário.

export type PdvAcesso = "operar" | "gerenciar";

export async function requirePdv(storeId?: string, nivel: PdvAcesso = "operar") {
  const user = await requireUser();
  const role = await prisma.role.findUnique({
    where: { id: user.role.id },
    select: { canOperarPdv: true, canGerenciarPdv: true },
  });
  const ok = nivel === "gerenciar" ? role?.canGerenciarPdv : role?.canOperarPdv || role?.canGerenciarPdv;
  if (!ok) redirect("/meu-ponto");

  if (!storeId) return { user, store: null };
  const store = await prisma.store.findFirst({
    where: { id: storeId, companyId: user.companyId },
    select: { id: true, name: true, companyId: true },
  });
  if (!store) redirect("/pdv");
  return { user, store };
}

/** Lojas que o usuário pode operar (as da empresa dele). */
export const listarLojasPdv = cache(async (companyId: string) =>
  prisma.store.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
);

// Pizzaria vira a meia-noite aberta: um pedido das 00:30 ainda é do "dia" de
// ontem. Corte às 05:00 no horário de Fortaleza (UTC-3, sem horário de verão).
const OFFSET_FORTALEZA_H = -3;
const CORTE_DIA_H = 5;

export function diaOperacional(agora = new Date()): Date {
  const local = new Date(agora.getTime() + (OFFSET_FORTALEZA_H - CORTE_DIA_H) * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function horaFortaleza(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });
}

// DDD das lojas (Ceará). Quem atende digita só o número; se vier sem DDD
// (8 ou 9 dígitos), completa com esse.
export const DDD_PADRAO = "85";

export function normalizarTelefone(t: string): string {
  const d = t.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 8 || d.length === 9 ? DDD_PADRAO + d : d;
}

/** "Rua X, 12 — Centro · ap 3 — ref: perto da praça" */
export function textoEndereco(e: { logradouro: string; numero?: string | null; bairro?: string | null; complemento?: string | null; referencia?: string | null }) {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const resto = [e.bairro, e.complemento].filter(Boolean).join(" · ");
  return [rua, resto, e.referencia ? `ref: ${e.referencia}` : ""].filter(Boolean).join(" — ");
}

type EventoHistorico = { evento: string; createdAt: Date; statusId: string | null };

/**
 * Quando o pedido entrou em cada status (a última vez, se voltou e avançou de
 * novo) — a partir do histórico. Status ainda não alcançados ficam sem hora.
 */
export function etapasDoPedido(status: { id: string; nome: string }[], historico: EventoHistorico[], statusAtualId: string | null) {
  const entrada = new Map<string, Date>();
  for (const h of historico) {
    if ((h.evento === "CRIADA" || h.evento === "STATUS") && h.statusId) entrada.set(h.statusId, h.createdAt);
  }
  const atual = status.findIndex((s) => s.id === statusAtualId);
  return status.map((s, i) => ({
    id: s.id,
    nome: s.nome,
    // depois do atual não conta (se voltou, a hora antiga não vale mais)
    em: i <= atual ? (entrada.get(s.id) ?? null) : null,
    atual: i === atual,
  }));
}

/** Etapas já percorridas com quanto tempo ficou em cada (a atual conta até agora). */
export function temposPorStatus(etapas: ReturnType<typeof etapasDoPedido>, fim: Date | null = null) {
  const agora = fim ?? new Date();
  return etapas
    .map((e, i) => {
      if (!e.em) return null;
      const saida = etapas[i + 1]?.em ?? (e.atual ? agora : null);
      return { nome: e.nome, hora: horaFortaleza(e.em), minutos: saida ? Math.max(0, Math.round((saida.getTime() - e.em.getTime()) / 60_000)) : null, atual: e.atual };
    })
    .filter((x) => x !== null);
}

export function minutosDesde(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60_000));
}

/** Próximo número do pedido no dia — UPDATE atômico, sem corrida entre caixas. */
export async function proximoNumero(tx: Prisma.TransactionClient, storeId: string, dia: Date): Promise<number> {
  const rows = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO "PdvContador" ("storeId", "dia", "ultimo") VALUES (${storeId}, ${dia}::date, 1)
    ON CONFLICT ("storeId", "dia") DO UPDATE SET "ultimo" = "PdvContador"."ultimo" + 1
    RETURNING "ultimo"`;
  return rows[0].ultimo;
}

const STATUS_PADRAO = [
  { nome: "Em preparo", ordem: 1, cor: "#fe9400", tag: "PRODUCAO" },
  { nome: "Pronto", ordem: 2, cor: "#ffd84d", tag: "PRONTO" },
  { nome: "Saiu pra entrega", ordem: 3, cor: "#6cb4ff", tag: "EM_ENTREGA" },
  { nome: "Entregue", ordem: 4, cor: "#4ade80", tag: "ENTREGUE" },
];

const FORMAS_PADRAO = [
  { nome: "Dinheiro", tipo: "DINHEIRO", ordem: 1 },
  { nome: "PIX", tipo: "PIX", ordem: 2 },
  { nome: "Crédito", tipo: "CARTAO_CREDITO", ordem: 3 },
  { nome: "Débito", tipo: "CARTAO_DEBITO", ordem: 4 },
];

const CATEGORIA_POR_TIPO = { PIZZA: "Pizzas", ESFIHA: "Esfihas", BEIRUTE: "Beirutes" } as const;

/**
 * Primeira vez que a loja/empresa abre o PDV: cria status e formas de
 * pagamento padrão e importa o cardápio das fichas técnicas (Receitas de
 * pizza/esfiha/beirute com preço). Idempotente — só cria o que falta.
 */
export async function garantirSetupPdv(companyId: string, storeId: string) {
  const [nStatus, nFormas, nProdutos] = await Promise.all([
    prisma.pdvStatus.count({ where: { storeId } }),
    prisma.pdvFormaPagamento.count({ where: { companyId } }),
    prisma.pdvProduto.count({ where: { companyId } }),
  ]);

  if (nStatus === 0) {
    await prisma.pdvStatus.createMany({ data: STATUS_PADRAO.map((s) => ({ ...s, storeId })) });
  }
  if (nFormas === 0) {
    await prisma.pdvFormaPagamento.createMany({
      data: FORMAS_PADRAO.map((f) => ({ ...f, companyId })),
      skipDuplicates: true,
    });
  }
  if (nProdutos === 0) {
    const receitas = await prisma.recipe.findMany({
      where: { type: { in: ["PIZZA", "ESFIHA", "BEIRUTE"] }, currentPrice: { gt: 0 } },
      orderBy: [{ type: "asc" }, { order: "asc" }, { name: "asc" }],
    });
    let ordemCat = 0;
    for (const [tipo, nome] of Object.entries(CATEGORIA_POR_TIPO)) {
      const daCategoria = receitas.filter((r) => r.type === tipo);
      if (daCategoria.length === 0) continue;
      const cat = await prisma.pdvCategoria.upsert({
        where: { companyId_nome: { companyId, nome } },
        create: { companyId, nome, ordem: ordemCat++ },
        update: {},
      });
      await prisma.pdvProduto.createMany({
        data: daCategoria.map((r, i) => ({
          companyId,
          categoriaId: cat.id,
          nome: r.name,
          preco: r.currentPrice!,
          recipeId: r.id,
          maxSabores: tipo === "PIZZA" ? 2 : 1,
          ordem: i,
        })),
      });
    }
  }
}

export async function caixaAberto(storeId: string, userId: string) {
  return prisma.pdvCaixa.findFirst({ where: { storeId, abertoPorId: userId, fechadoEm: null } });
}

const cents = (v: Prisma.Decimal | number | null | undefined) => Math.round(Number(v ?? 0) * 100);

/**
 * Quanto deveria ter em cada forma de pagamento no caixa: dinheiro = troco
 * inicial + vendas em dinheiro + reforços − sangrias − despesas; o resto =
 * soma das vendas naquela forma. Vendas canceladas e pagamentos estornados
 * não contam.
 */
export async function esperadoDoCaixa(caixaId: string) {
  const caixa = await prisma.pdvCaixa.findUniqueOrThrow({
    where: { id: caixaId },
    include: {
      movimentos: true,
      pagamentos: { where: { estornadoEm: null, venda: { situacao: { not: "CANCELADA" } } }, include: { forma: true } },
      store: { select: { companyId: true } },
    },
  });
  const formas = await prisma.pdvFormaPagamento.findMany({
    where: { companyId: caixa.store.companyId, ativo: true },
    orderBy: { ordem: "asc" },
  });

  const porForma = new Map<string, number>(formas.map((f) => [f.id, 0]));
  for (const p of caixa.pagamentos) porForma.set(p.formaId, (porForma.get(p.formaId) ?? 0) + cents(p.valor));

  const dinheiro = formas.find((f) => f.tipo === "DINHEIRO");
  let movimentosCents = 0;
  for (const m of caixa.movimentos) movimentosCents += m.tipo === "REFORCO" ? cents(m.valor) : -cents(m.valor);
  if (dinheiro) {
    porForma.set(dinheiro.id, (porForma.get(dinheiro.id) ?? 0) + cents(caixa.valorInicial) + movimentosCents);
  }

  return {
    caixa,
    linhas: formas.map((f) => ({ formaId: f.id, forma: f.nome, tipo: f.tipo, esperado: (porForma.get(f.id) ?? 0) / 100 })),
  };
}
