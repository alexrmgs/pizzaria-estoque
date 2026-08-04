"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { REVENUE_CHANNEL_LABELS } from "@/lib/financeiro";

const revenueSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  storeId: z.string().trim().min(1, "Selecione a loja."),
  channel: z.enum(["LOJA_PROPRIA", "IFOOD", "NOVENTA_NOVE"]),
  amount: z.coerce.number().min(0, "O faturamento não pode ser negativo."),
  orderCount: z.coerce.number().int().min(0, "A quantidade de pedidos não pode ser negativa."),
  note: z.string().trim().max(500).optional(),
});

export type RevenueFormState = { error?: string } | undefined;

function formatDatePt(date: Date) {
  return date.toISOString().slice(0, 10).split("-").reverse().join("/");
}

export async function createRevenue(
  _prevState: RevenueFormState,
  formData: FormData,
): Promise<RevenueFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = revenueSchema.safeParse({
    date: formData.get("date"),
    storeId: formData.get("storeId"),
    channel: formData.get("channel") || "LOJA_PROPRIA",
    amount: formData.get("amount"),
    orderCount: formData.get("orderCount") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  const existing = await prisma.revenue.findUnique({
    where: {
      date_storeId_channel: { date, storeId: parsed.data.storeId, channel: parsed.data.channel },
    },
    include: { store: { select: { name: true } } },
  });
  if (existing) {
    return {
      error: `Já existe um lançamento de ${existing.store.name} (${REVENUE_CHANNEL_LABELS[parsed.data.channel]}) em ${formatDatePt(date)}. Pra ajustar, edite esse lançamento na tabela em vez de criar outro.`,
    };
  }

  await prisma.revenue.create({
    data: {
      date,
      storeId: parsed.data.storeId,
      channel: parsed.data.channel,
      amount: parsed.data.amount,
      orderCount: parsed.data.orderCount,
      note: parsed.data.note,
      userId: user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}

export async function updateRevenue(
  id: string,
  _prevState: RevenueFormState,
  formData: FormData,
): Promise<RevenueFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = revenueSchema.safeParse({
    date: formData.get("date"),
    storeId: formData.get("storeId"),
    channel: formData.get("channel") || "LOJA_PROPRIA",
    amount: formData.get("amount"),
    orderCount: formData.get("orderCount") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  const existing = await prisma.revenue.findUnique({
    where: {
      date_storeId_channel: { date, storeId: parsed.data.storeId, channel: parsed.data.channel },
    },
    include: { store: { select: { name: true } } },
  });
  if (existing && existing.id !== id) {
    return {
      error: `Já existe um lançamento de ${existing.store.name} (${REVENUE_CHANNEL_LABELS[parsed.data.channel]}) em ${formatDatePt(date)}. Pra ajustar, edite esse lançamento na tabela em vez de duplicar.`,
    };
  }

  await prisma.revenue.update({
    where: { id },
    data: {
      date,
      storeId: parsed.data.storeId,
      channel: parsed.data.channel,
      amount: parsed.data.amount,
      orderCount: parsed.data.orderCount,
      note: parsed.data.note,
      userId: user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}

const dailySplitSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  storeId: z.string().trim().min(1, "Selecione a loja."),
  totalAmount: z.coerce.number().min(0, "O faturamento total não pode ser negativo."),
  ifoodAmount: z.coerce.number().min(0, "O faturamento do iFood não pode ser negativo."),
  ifoodOrders: z.coerce.number().int().min(0),
  food99Amount: z.coerce.number().min(0, "O faturamento do 99Food não pode ser negativo."),
  food99Orders: z.coerce.number().int().min(0),
  lojaOrders: z.coerce.number().int().min(0),
  note: z.string().trim().max(500).optional(),
});

export type DailySplitFormState = { error?: string } | undefined;

/**
 * Lançamento único do faturamento total do dia — o usuário informa quanto
 * veio de iFood e 99Food (com os respectivos pedidos), e o valor da loja
 * própria é calculado como o restante, evitando ter que separar e somar os
 * três valores manualmente. Cria/atualiza os três registros de Revenue
 * (um por canal) de uma vez; reenviar pro mesmo dia/loja substitui os
 * valores anteriores.
 */
export async function createDailyRevenueSplit(
  _prevState: DailySplitFormState,
  formData: FormData,
): Promise<DailySplitFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = dailySplitSchema.safeParse({
    date: formData.get("date"),
    storeId: formData.get("storeId"),
    totalAmount: formData.get("totalAmount"),
    ifoodAmount: formData.get("ifoodAmount") || 0,
    ifoodOrders: formData.get("ifoodOrders") || 0,
    food99Amount: formData.get("food99Amount") || 0,
    food99Orders: formData.get("food99Orders") || 0,
    lojaOrders: formData.get("lojaOrders") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { totalAmount, ifoodAmount, food99Amount } = parsed.data;
  const lojaAmount = totalAmount - ifoodAmount - food99Amount;
  if (lojaAmount < 0) {
    return {
      error: `O faturamento total (R$ ${totalAmount.toFixed(2)}) é menor que iFood + 99Food somados (R$ ${(ifoodAmount + food99Amount).toFixed(2)}). Confira os valores.`,
    };
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  const channelData: { channel: "LOJA_PROPRIA" | "IFOOD" | "NOVENTA_NOVE"; amount: number; orderCount: number }[] = [
    { channel: "LOJA_PROPRIA", amount: lojaAmount, orderCount: parsed.data.lojaOrders },
    { channel: "IFOOD", amount: ifoodAmount, orderCount: parsed.data.ifoodOrders },
    { channel: "NOVENTA_NOVE", amount: food99Amount, orderCount: parsed.data.food99Orders },
  ];

  await prisma.$transaction(
    channelData.map((c) =>
      prisma.revenue.upsert({
        where: {
          date_storeId_channel: { date, storeId: parsed.data.storeId, channel: c.channel },
        },
        create: {
          date,
          storeId: parsed.data.storeId,
          channel: c.channel,
          amount: c.amount,
          orderCount: c.orderCount,
          note: parsed.data.note,
          userId: user.id,
        },
        update: {
          amount: c.amount,
          orderCount: c.orderCount,
          note: parsed.data.note,
          userId: user.id,
        },
      }),
    ),
  );

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}

export type DailyRevenueSplitData = {
  totalAmount: number;
  ifoodAmount: number;
  ifoodOrders: number;
  food99Amount: number;
  food99Orders: number;
  lojaOrders: number;
  note: string;
};

/** Busca os lançamentos já existentes (por canal) de um dia/loja pra
 * preencher o diálogo de lançamento rápido — sem isso, reabrir o diálogo
 * pra ajustar um canal zerava os outros ao salvar. */
export async function getDailyRevenueSplit(
  storeId: string,
  dateStr: string,
): Promise<DailyRevenueSplitData | null> {
  await requirePermission("canViewRelatorios");

  if (!storeId || !dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00Z`);
  const rows = await prisma.revenue.findMany({ where: { storeId, date } });
  if (rows.length === 0) return null;

  const byChannel = new Map(rows.map((r) => [r.channel, r]));
  const loja = byChannel.get("LOJA_PROPRIA");
  const ifood = byChannel.get("IFOOD");
  const food99 = byChannel.get("NOVENTA_NOVE");
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    totalAmount,
    ifoodAmount: ifood ? Number(ifood.amount) : 0,
    ifoodOrders: ifood?.orderCount ?? 0,
    food99Amount: food99 ? Number(food99.amount) : 0,
    food99Orders: food99?.orderCount ?? 0,
    lojaOrders: loja?.orderCount ?? 0,
    note: loja?.note ?? ifood?.note ?? food99?.note ?? "",
  };
}

export async function deleteRevenue(id: string) {
  await requirePermission("canViewRelatorios");
  await prisma.revenue.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}
