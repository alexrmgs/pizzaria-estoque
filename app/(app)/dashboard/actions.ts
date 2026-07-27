"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const revenueSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  amount: z.coerce.number().min(0, "O faturamento não pode ser negativo."),
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
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  await prisma.revenue.upsert({
    where: { date },
    update: { amount: parsed.data.amount, note: parsed.data.note, userId: user.id },
    create: { date, amount: parsed.data.amount, note: parsed.data.note, userId: user.id },
  });

  revalidatePath("/dashboard");
}
