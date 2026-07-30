"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const revenueSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  storeId: z.string().trim().min(1, "Selecione a loja."),
  amount: z.coerce.number().min(0, "O faturamento não pode ser negativo."),
  orderCount: z.coerce.number().int().min(0, "A quantidade de pedidos não pode ser negativa."),
  note: z.string().trim().max(500).optional(),
});

export type RevenueFormState = { error?: string } | undefined;

export async function upsertRevenue(
  _prevState: RevenueFormState,
  formData: FormData,
): Promise<RevenueFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = revenueSchema.safeParse({
    date: formData.get("date"),
    storeId: formData.get("storeId"),
    amount: formData.get("amount"),
    orderCount: formData.get("orderCount") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  await prisma.revenue.upsert({
    where: { date_storeId: { date, storeId: parsed.data.storeId } },
    update: {
      amount: parsed.data.amount,
      orderCount: parsed.data.orderCount,
      note: parsed.data.note,
      userId: user.id,
    },
    create: {
      date,
      storeId: parsed.data.storeId,
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
