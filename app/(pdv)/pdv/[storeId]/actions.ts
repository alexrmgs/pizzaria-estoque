"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { distanciaKm, geocodificar, taxaDaFaixa } from "@/lib/pdv-entrega";
import { caixaAberto, diaOperacional, esperadoDoCaixa, normalizarTelefone, proximoNumero, requirePdv, textoEndereco } from "@/lib/pdv";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const toCents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => new Prisma.Decimal(c).div(100);

const enderecoSchema = z.object({
  id: z.string().optional(),
  logradouro: z.string().trim().min(2, "Falta a rua").max(150),
  numero: z.string().trim().max(20).optional(),
  bairro: z.string().trim().max(80).optional(),
  complemento: z.string().trim().max(120).optional(),
  referencia: z.string().trim().max(150).optional(),
});

export type EnderecoInput = z.input<typeof enderecoSchema>;

const vendaSchema = z.object({
  clientRequestId: z.string().min(8).max(64),
  modulo: z.enum(["BALCAO", "DELIVERY"]).default("BALCAO"),
  clienteNome: z.string().trim().max(80).optional(),
  telefone: z.string().trim().max(30).optional(),
  endereco: enderecoSchema.optional(),
  taxaEntrega: z.number().min(0).max(500).default(0),
  obsEntrega: z.string().trim().max(300).optional(),
  obs: z.string().trim().max(300).optional(),
  itens: z
    .array(z.object({ produtoId: z.string(), qtd: z.number().int().positive().max(999), obs: z.string().trim().max(200).optional() }))
    .min(1, "Pedido sem itens"),
  desconto: z.number().min(0).default(0),
  descontoMotivo: z.string().trim().max(120).optional(),
  acrescimo: z.number().min(0).default(0),
  acrescimoMotivo: z.string().trim().max(120).optional(),
  pagamentos: z
    .array(z.object({ formaId: z.string(), valor: z.number().positive(), trocoPara: z.number().positive().optional() }))
    .min(1, "Falta o pagamento"),
});

export type NovaVendaInput = z.input<typeof vendaSchema>;

export type ClienteEncontrado = {
  id: string;
  nome: string;
  telefone: string;
  enderecos: { id: string; texto: string; taxaEntrega: number; logradouro: string; numero: string; bairro: string; complemento: string; referencia: string }[];
  ultimosPedidos: number;
};

/**
 * Cadastra o cliente (ou atualiza o nome) e, se vier, adiciona um endereço.
 * Usado na identificação do pedido, antes da tela de itens.
 */
export async function salvarCliente(
  storeId: string,
  input: { telefone: string; nome: string; endereco?: EnderecoInput }
): Promise<Resultado<{ cliente: ClienteEncontrado; enderecoId: string | null }>> {
  const { store } = await requirePdv(storeId);
  const telefone = normalizarTelefone(input.telefone);
  const nome = input.nome.trim().slice(0, 80);
  if (telefone.length < 10) return { ok: false, error: "Telefone com DDD, por favor" };
  if (!nome) return { ok: false, error: "Falta o nome" };
  let endereco: z.infer<typeof enderecoSchema> | undefined;
  if (input.endereco) {
    const e = enderecoSchema.safeParse(input.endereco);
    if (!e.success) return { ok: false, error: e.error.issues[0]?.message ?? "Endereço inválido" };
    endereco = e.data;
  }

  const cliente = await prisma.pdvCliente.upsert({
    where: { companyId_telefone: { companyId: store!.companyId, telefone } },
    create: { companyId: store!.companyId, telefone, nome },
    update: { nome },
  });
  let enderecoId: string | null = null;
  if (endereco) {
    const novo = await prisma.pdvEndereco.create({
      data: {
        clienteId: cliente.id,
        logradouro: endereco.logradouro,
        numero: endereco.numero || null,
        bairro: endereco.bairro || null,
        complemento: endereco.complemento || null,
        referencia: endereco.referencia || null,
      },
    });
    enderecoId = novo.id;
  }
  const encontrado = await buscarCliente(storeId, telefone);
  return { ok: true, cliente: encontrado!, enderecoId };
}

/** Busca o cliente do delivery pelo telefone (só dígitos, com DDD). */
export async function buscarCliente(storeId: string, telefone: string): Promise<ClienteEncontrado | null> {
  const { store } = await requirePdv(storeId);
  const tel = normalizarTelefone(telefone);
  if (tel.length < 10) return null;
  const c = await prisma.pdvCliente.findFirst({
    // aceita digitar sem DDD: casa pelo final do número
    where: { companyId: store!.companyId, OR: [{ telefone: tel }, { telefone: { endsWith: tel } }] },
    include: { enderecos: { orderBy: { updatedAt: "desc" } }, _count: { select: { vendas: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (!c) return null;
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    ultimosPedidos: c._count.vendas,
    enderecos: c.enderecos.map((e) => ({
      id: e.id,
      texto: textoEndereco(e),
      taxaEntrega: Number(e.taxaEntrega),
      logradouro: e.logradouro,
      numero: e.numero ?? "",
      bairro: e.bairro ?? "",
      complemento: e.complemento ?? "",
      referencia: e.referencia ?? "",
    })),
  };
}

/**
 * Lança o pedido (balcão ou delivery) com a forma de pagamento prevista. O servidor recalcula tudo a partir do cardápio —
 * preço vindo da tela é ignorado. Repetir o mesmo clientRequestId devolve a
 * venda já criada (clique duplo / rede lenta).
 */
export async function criarVenda(storeId: string, input: NovaVendaInput): Promise<Resultado<{ vendaId: string; numero: number }>> {
  const { user, store } = await requirePdv(storeId);
  const parsed = vendaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;

  const repetida = await prisma.pdvVenda.findUnique({ where: { clientRequestId: v.clientRequestId } });
  if (repetida) return { ok: true, vendaId: repetida.id, numero: repetida.numero };

  const caixa = await caixaAberto(store!.id, user.id);
  if (!caixa) return { ok: false, error: "Abra o caixa antes de vender" };

  const produtos = await prisma.pdvProduto.findMany({
    where: { id: { in: v.itens.map((i) => i.produtoId) }, companyId: store!.companyId, ativo: true },
  });
  const porId = new Map(produtos.map((p) => [p.id, p]));
  if (v.itens.some((i) => !porId.has(i.produtoId))) return { ok: false, error: "Algum produto saiu do cardápio. Recarregue a tela." };

  const itens = v.itens.map((i) => {
    const p = porId.get(i.produtoId)!;
    const unit = toCents(Number(p.preco));
    return { p, qtd: i.qtd, obs: i.obs || null, unit, total: unit * i.qtd };
  });
  const ehDelivery = v.modulo === "DELIVERY";
  const telefone = normalizarTelefone(v.telefone ?? "");
  if (ehDelivery) {
    if (!v.clienteNome) return { ok: false, error: "Falta o nome do cliente" };
    if (telefone.length < 10) return { ok: false, error: "Telefone com DDD, por favor" };
    if (!v.endereco) return { ok: false, error: "Falta o endereço de entrega" };
  }
  const taxaEntrega = ehDelivery ? toCents(v.taxaEntrega) : 0;

  const subtotal = itens.reduce((s, i) => s + i.total, 0);
  const desconto = toCents(v.desconto);
  const acrescimo = toCents(v.acrescimo);
  if (desconto > 0 && !v.descontoMotivo) return { ok: false, error: "Diga o motivo do desconto" };
  if (acrescimo > 0 && !v.acrescimoMotivo) return { ok: false, error: "Diga o motivo do acréscimo" };
  const total = subtotal + taxaEntrega + acrescimo - desconto;
  if (total < 0) return { ok: false, error: "Desconto maior que o pedido" };

  const formas = await prisma.pdvFormaPagamento.findMany({
    where: { id: { in: v.pagamentos.map((p) => p.formaId) }, companyId: store!.companyId, ativo: true },
  });
  const formaPorId = new Map(formas.map((f) => [f.id, f]));
  let pago = 0;
  for (const pg of v.pagamentos) {
    const f = formaPorId.get(pg.formaId);
    if (!f) return { ok: false, error: "Forma de pagamento inválida" };
    if (pg.trocoPara != null && (f.tipo !== "DINHEIRO" || toCents(pg.trocoPara) < toCents(pg.valor))) {
      return { ok: false, error: "Troco só em dinheiro, e maior que o valor" };
    }
    pago += toCents(pg.valor);
  }
  if (pago !== total) return { ok: false, error: `Pagamentos somam ${(pago / 100).toFixed(2)}, pedido é ${(total / 100).toFixed(2)}` };

  const primeiroStatus = await prisma.pdvStatus.findFirst({ where: { storeId: store!.id }, orderBy: { ordem: "asc" } });
  const dia = diaOperacional();

  try {
    const venda = await prisma.$transaction(async (tx) => {
      // delivery: cria/atualiza o cliente pelo telefone e guarda o endereço
      // (com a taxa, que vem preenchida no próximo pedido pra lá)
      let clienteId: string | null = null;
      let enderecoTexto: string | null = null;
      if (ehDelivery && v.endereco) {
        const cliente = await tx.pdvCliente.upsert({
          where: { companyId_telefone: { companyId: store!.companyId, telefone } },
          create: { companyId: store!.companyId, telefone, nome: v.clienteNome! },
          update: { nome: v.clienteNome! },
        });
        clienteId = cliente.id;
        const dadosEnd = {
          logradouro: v.endereco.logradouro,
          numero: v.endereco.numero || null,
          bairro: v.endereco.bairro || null,
          complemento: v.endereco.complemento || null,
          referencia: v.endereco.referencia || null,
          taxaEntrega: fromCents(taxaEntrega),
        };
        const existente = v.endereco.id
          ? await tx.pdvEndereco.findFirst({ where: { id: v.endereco.id, clienteId: cliente.id } })
          : null;
        if (existente) await tx.pdvEndereco.update({ where: { id: existente.id }, data: dadosEnd });
        else await tx.pdvEndereco.create({ data: { ...dadosEnd, clienteId: cliente.id } });
        enderecoTexto = textoEndereco(dadosEnd);
      }

      const numero = await proximoNumero(tx, store!.id, dia);
      return tx.pdvVenda.create({
        data: {
          storeId: store!.id,
          numero,
          dia,
          modulo: v.modulo,
          clienteNome: v.clienteNome || null,
          clienteId,
          enderecoTexto,
          taxaEntrega: fromCents(taxaEntrega),
          obsEntrega: ehDelivery ? v.obsEntrega || null : null,
          obs: v.obs || null,
          statusId: primeiroStatus?.id,
          caixaId: caixa.id,
          subtotal: fromCents(subtotal),
          desconto: fromCents(desconto),
          descontoMotivo: desconto > 0 ? v.descontoMotivo : null,
          acrescimo: fromCents(acrescimo),
          acrescimoMotivo: acrescimo > 0 ? v.acrescimoMotivo : null,
          total: fromCents(total),
          // pagamento aqui é só o previsto: entra no caixa ao finalizar o pedido
          situacao: "ABERTA",
          clientRequestId: v.clientRequestId,
          createdById: user.id,
          itens: {
            create: itens.map((i) => ({
              produtoId: i.p.id,
              nome: i.p.nome,
              qtd: i.qtd,
              precoUnit: fromCents(i.unit),
              total: fromCents(i.total),
              obs: i.obs,
              cobraServico: i.p.cobraServico,
              userId: user.id,
            })),
          },
          pagamentos: {
            create: v.pagamentos.map((pg) => ({
              formaId: pg.formaId,
              caixaId: null,
              valor: fromCents(toCents(pg.valor)),
              trocoPara: pg.trocoPara != null ? fromCents(toCents(pg.trocoPara)) : null,
              userId: user.id,
            })),
          },
          historico: { create: { evento: "CRIADA", statusId: primeiroStatus?.id, userId: user.id } },
        },
      });
    });
    revalidatePath(`/pdv/${store!.id}`);
    return { ok: true, vendaId: venda.id, numero: venda.numero };
  } catch (e) {
    // corrida com o mesmo clientRequestId: a outra requisição já criou
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const ja = await prisma.pdvVenda.findUnique({ where: { clientRequestId: v.clientRequestId } });
      if (ja) return { ok: true, vendaId: ja.id, numero: ja.numero };
    }
    throw e;
  }
}

/** Avança (+1) ou volta (−1) o pedido uma coluna no quadro. */
export async function moverStatus(storeId: string, vendaId: string, sentido: 1 | -1): Promise<Resultado> {
  const { user, store } = await requirePdv(storeId);
  const venda = await prisma.pdvVenda.findFirst({ where: { id: vendaId, storeId: store!.id } });
  if (!venda) return { ok: false, error: "Pedido não encontrado" };
  if (venda.situacao === "CANCELADA") return { ok: false, error: "Pedido cancelado" };

  const status = await prisma.pdvStatus.findMany({ where: { storeId: store!.id }, orderBy: { ordem: "asc" } });
  const atual = status.findIndex((s) => s.id === venda.statusId);
  const destino = status[atual + sentido];
  if (!destino) return { ok: false, error: sentido > 0 ? "Já está no último status" : "Já está no primeiro status" };

  // só move se ninguém mexeu no meio do caminho (dois toques/duas telas)
  const { count } = await prisma.pdvVenda.updateMany({
    where: { id: venda.id, statusId: venda.statusId },
    data: { statusId: destino.id },
  });
  if (count === 0) return { ok: false, error: "Outra tela já moveu esse pedido" };
  await prisma.pdvStatusHistorico.create({ data: { vendaId: venda.id, statusId: destino.id, evento: "STATUS", userId: user.id } });
  revalidatePath(`/pdv/${store!.id}`);
  return { ok: true };
}

const pagamentosSchema = z
  .array(z.object({ formaId: z.string(), valor: z.number().positive(), trocoPara: z.number().positive().optional() }))
  .min(1, "Falta o pagamento");

/**
 * Finaliza o pedido: confere a forma de pagamento (pode trocar/dividir) e só
 * então o valor entra no caixa de quem finalizou. O pedido sai do quadro.
 */
export async function finalizarVenda(
  storeId: string,
  vendaId: string,
  pagamentos: z.input<typeof pagamentosSchema>
): Promise<Resultado> {
  const { user, store } = await requirePdv(storeId);
  const parsed = pagamentosSchema.safeParse(pagamentos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Pagamento inválido" };
  const caixa = await caixaAberto(store!.id, user.id);
  if (!caixa) return { ok: false, error: "Abra o seu caixa pra finalizar" };

  const venda = await prisma.pdvVenda.findFirst({ where: { id: vendaId, storeId: store!.id } });
  if (!venda) return { ok: false, error: "Pedido não encontrado" };
  if (venda.situacao !== "ABERTA") return { ok: false, error: venda.situacao === "CANCELADA" ? "Pedido cancelado" : "Pedido já finalizado" };

  const formas = await prisma.pdvFormaPagamento.findMany({ where: { companyId: store!.companyId, ativo: true } });
  const formaPorId = new Map(formas.map((f) => [f.id, f]));
  let pago = 0;
  for (const pg of parsed.data) {
    const f = formaPorId.get(pg.formaId);
    if (!f) return { ok: false, error: "Forma de pagamento inválida" };
    if (pg.trocoPara != null && (f.tipo !== "DINHEIRO" || toCents(pg.trocoPara) < toCents(pg.valor))) {
      return { ok: false, error: "Troco só em dinheiro, e maior que o valor" };
    }
    pago += toCents(pg.valor);
  }
  const total = toCents(Number(venda.total));
  if (pago !== total) return { ok: false, error: `Pagamentos somam ${(pago / 100).toFixed(2)}, pedido é ${(total / 100).toFixed(2)}` };

  const ok = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pdvVenda.updateMany({
      where: { id: venda.id, situacao: "ABERTA" },
      data: { situacao: "PAGA", fechadaEm: new Date() },
    });
    if (count === 0) return false;
    // troca o previsto pelo conferido
    await tx.pdvPagamento.deleteMany({ where: { vendaId: venda.id, caixaId: null } });
    await tx.pdvPagamento.createMany({
      data: parsed.data.map((pg) => ({
        vendaId: venda.id,
        formaId: pg.formaId,
        caixaId: caixa.id,
        valor: fromCents(toCents(pg.valor)),
        trocoPara: pg.trocoPara != null ? fromCents(toCents(pg.trocoPara)) : null,
        userId: user.id,
      })),
    });
    await tx.pdvStatusHistorico.create({ data: { vendaId: venda.id, evento: "PAGA", userId: user.id } });
    return true;
  });
  if (!ok) return { ok: false, error: "Outra tela já finalizou esse pedido" };
  revalidatePath(`/pdv/${store!.id}`, "layout");
  return { ok: true };
}

export async function cancelarVenda(storeId: string, vendaId: string, motivo: string): Promise<Resultado> {
  const { user, store } = await requirePdv(storeId, "gerenciar");
  if (!motivo.trim()) return { ok: false, error: "Diga o motivo do cancelamento" };
  const { count } = await prisma.pdvVenda.updateMany({
    where: { id: vendaId, storeId: store!.id, situacao: { not: "CANCELADA" } },
    data: { situacao: "CANCELADA", canceladaEm: new Date(), cancelMotivo: motivo.trim().slice(0, 200) },
  });
  if (count === 0) return { ok: false, error: "Pedido não encontrado ou já cancelado" };
  await prisma.pdvStatusHistorico.create({ data: { vendaId, evento: "CANCELADA", userId: user.id } });
  revalidatePath(`/pdv/${store!.id}`);
  return { ok: true };
}

export async function abrirCaixa(storeId: string, valorInicial: number): Promise<Resultado> {
  const { user, store } = await requirePdv(storeId);
  if (!(valorInicial >= 0)) return { ok: false, error: "Valor inválido" };
  if (await caixaAberto(store!.id, user.id)) return { ok: true };
  try {
    await prisma.pdvCaixa.create({ data: { storeId: store!.id, abertoPorId: user.id, valorInicial: fromCents(toCents(valorInicial)) } });
  } catch (e) {
    // índice "um caixa aberto por usuário": outra aba abriu ao mesmo tempo
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  revalidatePath(`/pdv/${store!.id}`, "layout");
  return { ok: true };
}

export async function movimentoCaixa(
  storeId: string,
  input: { tipo: "REFORCO" | "SANGRIA" | "DESPESA"; valor: number; motivo: string }
): Promise<Resultado> {
  const { user, store } = await requirePdv(storeId);
  const caixa = await caixaAberto(store!.id, user.id);
  if (!caixa) return { ok: false, error: "Nenhum caixa aberto" };
  if (!["REFORCO", "SANGRIA", "DESPESA"].includes(input.tipo)) return { ok: false, error: "Tipo inválido" };
  if (!(input.valor > 0)) return { ok: false, error: "Valor precisa ser maior que zero" };
  if (!input.motivo.trim()) return { ok: false, error: "Diga o motivo" };
  await prisma.pdvCaixaMovimento.create({
    data: { caixaId: caixa.id, tipo: input.tipo, valor: fromCents(toCents(input.valor)), motivo: input.motivo.trim().slice(0, 200), userId: user.id },
  });
  revalidatePath(`/pdv/${store!.id}/caixa`);
  return { ok: true };
}

/**
 * Fecha o caixa do próprio usuário. Diferença entre esperado e contado em
 * qualquer forma exige observação.
 */
export async function fecharCaixa(storeId: string, contado: Record<string, number>, obs: string): Promise<Resultado<{ caixaId: string }>> {
  const { user, store } = await requirePdv(storeId);
  const caixa = await caixaAberto(store!.id, user.id);
  if (!caixa) return { ok: false, error: "Nenhum caixa aberto" };

  const { linhas } = await esperadoDoCaixa(caixa.id);
  const conf = linhas.map((l) => ({ ...l, contado: Number.isFinite(contado[l.formaId]) ? contado[l.formaId] : 0 }));
  const temDiferenca = conf.some((l) => toCents(l.contado) !== toCents(l.esperado));
  if (temDiferenca && !obs.trim()) return { ok: false, error: "Tem diferença no caixa: explique na observação" };

  const fechou = await prisma.$transaction(async (tx) => {
    const { count } = await tx.pdvCaixa.updateMany({
      where: { id: caixa.id, fechadoEm: null },
      data: { fechadoEm: new Date(), fechadoPorId: user.id, obs: obs.trim() || null },
    });
    if (count === 0) return false;
    await tx.pdvCaixaConferencia.createMany({
      data: conf.map((l) => ({ caixaId: caixa.id, formaId: l.formaId, esperado: fromCents(toCents(l.esperado)), contado: fromCents(toCents(l.contado)) })),
    });
    return true;
  });
  if (!fechou) return { ok: false, error: "Esse caixa já foi fechado" };
  revalidatePath(`/pdv/${store!.id}`, "layout");
  return { ok: true, caixaId: caixa.id };
}

export type TaxaCalculada =
  | { ok: true; km: number; taxa: number | null; precisao: "rua" | "bairro"; semFaixas: boolean }
  | { ok: false; error: string };

/**
 * Taxa de entrega pela distância da loja até o endereço (linha reta, como o
 * raio do SaiPos). O ponto do endereço é achado uma vez e guardado.
 */
export async function calcularTaxaEntrega(storeId: string, enderecoId: string): Promise<TaxaCalculada> {
  const { store } = await requirePdv(storeId);
  const [loja, end, faixas] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: store!.id }, select: { latitude: true, longitude: true } }),
    prisma.pdvEndereco.findFirst({ where: { id: enderecoId, cliente: { companyId: store!.companyId } } }),
    prisma.pdvFaixaEntrega.findMany({ where: { storeId: store!.id } }),
  ]);
  if (!end) return { ok: false, error: "Endereço não encontrado" };
  const pontoLoja = { lat: Number(loja.latitude), lng: Number(loja.longitude) };

  let ponto = end.latitude != null && end.longitude != null ? { lat: Number(end.latitude), lng: Number(end.longitude), precisao: "rua" as const } : null;
  if (!ponto) {
    const achado = await geocodificar(end, pontoLoja);
    if (!achado) return { ok: false, error: "Não achei esse endereço no mapa — digite a taxa" };
    // só guarda quando achou a rua; centro do bairro é aproximado, tenta de novo da próxima vez
    if (achado.precisao === "rua") {
      await prisma.pdvEndereco.update({ where: { id: end.id }, data: { latitude: achado.lat, longitude: achado.lng } });
    }
    ponto = achado as typeof achado & { precisao: "rua" };
  }

  const km = distanciaKm(pontoLoja, ponto);
  return {
    ok: true,
    km,
    taxa: taxaDaFaixa(faixas.map((f) => ({ ateKm: Number(f.ateKm), taxa: Number(f.taxa) })), km),
    precisao: ponto.precisao,
    semFaixas: faixas.length === 0,
  };
}

/** Troca todas as faixas de taxa da loja de uma vez (tela Taxas de entrega). */
export async function salvarFaixas(storeId: string, faixas: { ateKm: number; taxa: number }[]): Promise<Resultado> {
  const { store } = await requirePdv(storeId, "gerenciar");
  const limpas = faixas.filter((f) => f.ateKm > 0);
  if (limpas.some((f) => !(f.taxa >= 0) || f.ateKm > 100)) return { ok: false, error: "Confira os valores (km até 100, taxa ≥ 0)" };
  if (new Set(limpas.map((f) => f.ateKm)).size !== limpas.length) return { ok: false, error: "Tem duas faixas com o mesmo km" };
  await prisma.$transaction([
    prisma.pdvFaixaEntrega.deleteMany({ where: { storeId: store!.id } }),
    prisma.pdvFaixaEntrega.createMany({
      data: limpas.map((f) => ({ storeId: store!.id, ateKm: fromCents(toCents(f.ateKm)), taxa: fromCents(toCents(f.taxa)) })),
    }),
  ]);
  revalidatePath(`/pdv/${store!.id}/entrega`);
  return { ok: true };
}
