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

export async function deleteRevenue(id: string) {
  await requirePermission("canViewRelatorios");
  await prisma.revenue.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}
