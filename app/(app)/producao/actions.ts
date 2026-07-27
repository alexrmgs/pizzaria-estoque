"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const productionSchema = z.object({
  ingredientId: z.array(z.string().trim().min(1)),
  quantity: z.array(z.coerce.number().min(0)),
  note: z.string().trim().max(500).optional(),
});

export type ProductionFormState = { error?: string; count?: number } | undefined;

export async function submitProduction(
  _prevState: ProductionFormState,
  formData: FormData,
): Promise<ProductionFormState> {
  const user = await requirePermission("canManageEstoque");

  const parsed = productionSchema.safeParse({
    ingredientId: formData.getAll("ingredientId"),
    quantity: formData.getAll("quantity"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { ingredientId, quantity, note } = parsed.data;
  const reason = note ? `Produção diária — ${note}` : "Produção diária";

  let count = 0;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ingredientId.length; i++) {
      if (quantity[i] <= 0) continue;

      count++;
      await tx.stockMovement.create({
        data: {
          ingredientId: ingredientId[i],
          type: "ENTRADA",
          quantity: quantity[i],
          reason,
          userId: user.id,
        },
      });
      await tx.ingredient.update({
        where: { id: ingredientId[i] },
        data: { currentStock: { increment: quantity[i] } },
      });
    }
  });

  revalidatePath("/producao");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/lista-compras");

  return { count };
}
