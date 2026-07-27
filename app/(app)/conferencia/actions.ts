"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const conferenceSchema = z.object({
  ingredientId: z.array(z.string().trim().min(1)),
  currentStock: z.array(z.coerce.number()),
  countedQty: z.array(z.coerce.number().min(0, "A contagem não pode ser negativa.")),
  note: z.string().trim().max(500).optional(),
});

export type ConferenceFormState = { error?: string; count?: number } | undefined;

export async function submitConference(
  _prevState: ConferenceFormState,
  formData: FormData,
): Promise<ConferenceFormState> {
  const user = await requirePermission("canManageEstoque");

  const parsed = conferenceSchema.safeParse({
    ingredientId: formData.getAll("ingredientId"),
    currentStock: formData.getAll("currentStock"),
    countedQty: formData.getAll("countedQty"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { ingredientId, currentStock, countedQty, note } = parsed.data;
  const reason = note ? `Conferência de estoque — ${note}` : "Conferência de estoque";

  let adjustedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ingredientId.length; i++) {
      const diff = countedQty[i] - currentStock[i];
      if (diff === 0) continue;

      adjustedCount++;
      await tx.stockMovement.create({
        data: {
          ingredientId: ingredientId[i],
          type: diff > 0 ? "ENTRADA" : "SAIDA",
          quantity: Math.abs(diff),
          reason,
          userId: user.id,
        },
      });
      await tx.ingredient.update({
        where: { id: ingredientId[i] },
        data: { currentStock: countedQty[i] },
      });
    }
  });

  revalidatePath("/conferencia");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/lista-compras");

  return { count: adjustedCount };
}
