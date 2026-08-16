"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { fetchSaiposSales, saiposChannel, saiposChannelStore } from "@/lib/saipos";

const schema = z.object({
  storeId: z.string().trim().min(1, "Selecione a loja."),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida."),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida."),
});

export type SaiposSyncResult = {
  error?: string;
  dias?: number;
  pedidos?: number;
  total?: number;
};

/**
 * Puxa o faturamento da SaiPos no período e grava no Financeiro: soma as vendas
 * por dia e por canal (loja, iFood, 99), ignorando canceladas, e cria/atualiza
 * os registros de Revenue. Reenviar o mesmo período substitui os valores.
 */
export async function sincronizarSaipos(input: {
  storeId: string;
  start: string;
  end: string;
}): Promise<SaiposSyncResult> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const start = new Date(`${parsed.data.start}T00:00:00Z`);
  const end = new Date(`${parsed.data.end}T00:00:00Z`);
  if (end < start) return { error: "A data final não pode ser antes da inicial." };
  const maxDays = 366;
  if ((end.getTime() - start.getTime()) / 86_400_000 > maxDays) {
    return { error: "Período muito longo. Puxe no máximo 1 ano por vez." };
  }

  const store = await prisma.store.findFirst({
    where: { id: parsed.data.storeId, companyId: user.companyId },
    select: { saiposToken: true },
  });
  if (!store?.saiposToken) {
    return { error: "Essa loja não tem token da SaiPos configurado (cadastre em Lojas)." };
  }

  let sales;
  try {
    sales = await fetchSaiposSales(store.saiposToken, start, end);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao consultar a SaiPos." };
  }

  // Agrega por dia + canal + loja-do-canal (ex: duas marcas no mesmo iFood).
  type Bucket = { amount: number; count: number };
  const byDayChannel = new Map<string, Bucket>();
  for (const sale of sales) {
    if ((sale.canceled ?? "").toUpperCase() === "Y") continue;
    const day = (sale.shift_date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const amount = Number(sale.total_amount) || 0;
    const channel = saiposChannel(sale);
    const channelStore = saiposChannelStore(sale);
    const key = JSON.stringify([day, channel, channelStore]);
    const bucket = byDayChannel.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += amount;
    bucket.count += 1;
    byDayChannel.set(key, bucket);
  }

  // Canal com "marcas" (iFood, 99 — várias lojinhas virtuais na mesma conta):
  // a SaiPos manda cada pedido DUAS vezes nesses casos — uma sem marca
  // (visão agregada do canal) e outra já com a marca — e as duas trazem o
  // valor cheio do pedido. Somando as duas, o total dobra. Quando existe a
  // versão com marca, ela já é o detalhamento certo: descarta a sem-marca
  // daquele canal naquele dia em vez de somar em cima.
  let parsedEntries = Array.from(byDayChannel.entries(), ([key, bucket]) => {
    const [day, channel, channelStore] = JSON.parse(key) as [string, string, string];
    return { day, channel, channelStore, bucket };
  });
  const temMarca = new Set(
    parsedEntries.filter((e) => e.channelStore !== "").map((e) => `${e.day}|${e.channel}`),
  );
  parsedEntries = parsedEntries.filter(
    (e) => e.channelStore !== "" || !temMarca.has(`${e.day}|${e.channel}`),
  );

  if (parsedEntries.length === 0) {
    return { dias: 0, pedidos: 0, total: 0 };
  }

  const dias = new Set(parsedEntries.map((e) => e.day)).size;
  const pedidos = parsedEntries.reduce((sum, e) => sum + e.bucket.count, 0);
  const total = parsedEntries.reduce((sum, e) => sum + e.bucket.amount, 0);

  // Quando a SaiPos ainda não tinha marcado a "lojinha"/marca de um pedido
  // (partner_sale.desc_store_partner vazio) na hora da 1ª sincronização, mas
  // já marca numa 2ª puxada mais tarde, a chave (canal, loja-do-canal) muda —
  // sem isso, a 2ª puxada só somaria em cima da 1ª em vez de substituir,
  // contando o mesmo pedido duas vezes. Por isso apaga, por dia, qualquer
  // linha importada da SaiPos que não bateu com o que essa puxada achou,
  // antes de gravar os valores atuais.
  const keysByDay = new Map<string, { channel: string; channelStore: string }[]>();
  for (const e of parsedEntries) {
    const list = keysByDay.get(e.day) ?? [];
    list.push({ channel: e.channel, channelStore: e.channelStore });
    keysByDay.set(e.day, list);
  }

  const deleteOps = Array.from(keysByDay.entries()).map(([day, keys]) =>
    prisma.revenue.deleteMany({
      where: {
        storeId: parsed.data.storeId,
        date: new Date(`${day}T00:00:00Z`),
        note: "Importado da SaiPos",
        NOT: { OR: keys.map((k) => ({ channel: k.channel, channelStore: k.channelStore })) },
      },
    }),
  );

  const upsertOps = parsedEntries.map(({ day, channel, channelStore, bucket }) => {
    const date = new Date(`${day}T00:00:00Z`);
    const amount = Math.round(bucket.amount * 100) / 100;
    return prisma.revenue.upsert({
      where: {
        date_storeId_channel_channelStore: { date, storeId: parsed.data.storeId, channel, channelStore },
      },
      create: {
        date,
        storeId: parsed.data.storeId,
        channel,
        channelStore,
        amount,
        orderCount: bucket.count,
        note: "Importado da SaiPos",
        userId: user.id,
      },
      update: {
        amount,
        orderCount: bucket.count,
        note: "Importado da SaiPos",
        userId: user.id,
      },
    });
  });

  // Em lotes pra não estourar o pool de conexões em períodos longos — os
  // deletes vêm primeiro (são poucos, um por dia) pra já limpar antes de
  // gravar os valores atuais.
  const BATCH = 50;
  await prisma.$transaction(deleteOps);
  for (let i = 0; i < upsertOps.length; i += BATCH) {
    await prisma.$transaction(upsertOps.slice(i, i + BATCH));
  }

  // Segunda rede de segurança: a SaiPos é instável e às vezes essa busca em
  // si só enxergou a versão sem marca de um canal (a marca ainda não tinha
  // chegado NESSA hora) — o filtro acima não pega isso porque só compara
  // dentro dos dados dessa mesma busca. Aqui a limpeza olha o BANCO inteiro
  // dessa loja: se em qualquer sincronização (essa ou uma anterior) sobrou
  // uma linha sem marca com uma versão com marca do mesmo dia/canal, apaga a
  // sem marca — ela é sempre o espelho agregado, nunca um pedido a mais.
  await prisma.$executeRaw`
    DELETE FROM "Revenue" alvo
    WHERE alvo."storeId" = ${parsed.data.storeId}
      AND alvo."channelStore" = ''
      AND alvo.note = 'Importado da SaiPos'
      AND EXISTS (
        SELECT 1 FROM "Revenue" "comMarca"
        WHERE "comMarca"."storeId" = alvo."storeId"
          AND "comMarca".date = alvo.date
          AND "comMarca".channel = alvo.channel
          AND "comMarca"."channelStore" != ''
      )
  `;

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  return { dias, pedidos, total };
}
