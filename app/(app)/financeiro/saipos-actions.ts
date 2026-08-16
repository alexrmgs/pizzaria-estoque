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
  let pedidos = 0;
  let total = 0;
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
    pedidos += 1;
    total += amount;
  }

  if (byDayChannel.size === 0) {
    return { dias: 0, pedidos: 0, total: 0 };
  }

  const dias = new Set(Array.from(byDayChannel.keys(), (k) => JSON.parse(k)[0])).size;

  const ops = Array.from(byDayChannel.entries()).map(([key, bucket]) => {
    const [day, channel, channelStore] = JSON.parse(key) as [string, string, string];
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

  // Em lotes pra não estourar o pool de conexões em períodos longos.
  const BATCH = 50;
  for (let i = 0; i < ops.length; i += BATCH) {
    await prisma.$transaction(ops.slice(i, i + BATCH));
  }

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  return { dias, pedidos, total };
}
