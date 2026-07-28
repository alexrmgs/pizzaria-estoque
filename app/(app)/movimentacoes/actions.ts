"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const movementSchema = z.object({
  ingredientId: z.string().trim().min(1, "Selecione um ingrediente."),
  type: z.enum(["ENTRADA", "SAIDA"]),
  quantity: z.coerce.number().positive("A quantidade deve ser maior que zero."),
  reason: z.string().trim().max(500).optional(),
});

export type MovementFormState = { error?: string } | undefined;

export async function createMovement(
  _prevState: MovementFormState,
  formData: FormData,
): Promise<MovementFormState> {
  const user = await requirePermission("canManageEstoque");

  const parsed = movementSchema.safeParse({
    ingredientId: formData.get("ingredientId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { ingredientId, type, quantity, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });

      const current = Number(ingredient.currentStock);
      if (type === "SAIDA" && quantity > current) {
        throw new Error(
          `Estoque insuficiente: há apenas ${current} ${ingredient.unit} de ${ingredient.name}.`,
        );
      }

      await tx.stockMovement.create({
        data: { ingredientId, type, quantity, reason, userId: user.id },
      });

      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          currentStock: type === "ENTRADA" ? { increment: quantity } : { decrement: quantity },
        },
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível registrar a movimentação." };
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

const batchItemSchema = z.object({
  ingredientId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(500).optional(),
});

const batchSchema = z.object({
  type: z.enum(["ENTRADA", "SAIDA"]),
  items: z.array(batchItemSchema).min(1, "Adicione ao menos um item à lista."),
});

export type BatchMovementState = { error?: string; count?: number } | undefined;

/**
 * Confere e efetiva uma lista de movimentações do mesmo tipo de uma vez só,
 * em vez de cada item virar uma movimentação assim que digitado.
 */
export async function createMovementsBatch(
  type: "ENTRADA" | "SAIDA",
  items: { ingredientId: string; quantity: number; reason?: string }[],
): Promise<BatchMovementState> {
  const user = await requirePermission("canManageEstoque");

  const parsed = batchSchema.safeParse({ type, items });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.items) {
        const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: item.ingredientId } });
        const current = Number(ingredient.currentStock);
        if (parsed.data.type === "SAIDA" && item.quantity > current) {
          throw new Error(
            `Estoque insuficiente: há apenas ${current} ${ingredient.unit} de ${ingredient.name}.`,
          );
        }
        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: parsed.data.type,
            quantity: item.quantity,
            reason: item.reason,
            userId: user.id,
          },
        });
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            currentStock:
              parsed.data.type === "ENTRADA"
                ? { increment: item.quantity }
                : { decrement: item.quantity },
          },
        });
      }
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível registrar as movimentações.",
    };
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");

  return { count: parsed.data.items.length };
}
