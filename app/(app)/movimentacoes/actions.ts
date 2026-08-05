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
  unitPrice: z.coerce.number().positive().optional(),
});

export type MovementFormState = { error?: string } | undefined;

/**
 * Custo médio ponderado: mistura o preço já cadastrado (aplicado ao estoque
 * que já existia) com o preço da entrada nova, proporcional à quantidade de
 * cada um — em vez de simplesmente sobrescrever o preço de todo o estoque
 * pelo valor da compra mais recente.
 */
function weightedAveragePrice(
  currentStock: number,
  currentPrice: number,
  incomingQuantity: number,
  incomingPrice: number,
): number {
  const totalQuantity = currentStock + incomingQuantity;
  if (totalQuantity <= 0) return incomingPrice;
  const blended = (currentStock * currentPrice + incomingQuantity * incomingPrice) / totalQuantity;
  return Math.round(blended * 100) / 100;
}

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

export async function updateMovement(
  id: string,
  _prevState: MovementFormState,
  formData: FormData,
): Promise<MovementFormState> {
  await requirePermission("canManageEstoque");

  const parsed = movementSchema.safeParse({
    ingredientId: formData.get("ingredientId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { ingredientId, type, quantity, reason, unitPrice } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const old = await tx.stockMovement.findUniqueOrThrow({ where: { id } });

      // Desfaz o efeito do lançamento antigo no ingrediente antigo antes de
      // aplicar o novo — assim dá pra editar quantidade, tipo ou até trocar
      // o ingrediente sem deixar o estoque incoerente.
      await tx.ingredient.update({
        where: { id: old.ingredientId },
        data: {
          currentStock:
            old.type === "ENTRADA" ? { decrement: old.quantity } : { increment: old.quantity },
        },
      });

      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
      const current = Number(ingredient.currentStock);
      if (type === "SAIDA" && quantity > current) {
        throw new Error(
          `Estoque insuficiente: depois de desfazer o lançamento antigo, há apenas ${current} ${ingredient.unit} de ${ingredient.name}.`,
        );
      }

      const newUnitPrice =
        type === "ENTRADA" && unitPrice !== undefined
          ? weightedAveragePrice(current, Number(ingredient.unitPrice), quantity, unitPrice)
          : undefined;
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          currentStock: type === "ENTRADA" ? { increment: quantity } : { decrement: quantity },
          ...(newUnitPrice !== undefined ? { unitPrice: newUnitPrice } : {}),
        },
      });

      await tx.stockMovement.update({
        where: { id },
        data: {
          ingredientId,
          type,
          quantity,
          reason,
          unitPriceAtEntry: type === "ENTRADA" ? (unitPrice ?? Number(ingredient.unitPrice)) : null,
        },
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível editar a movimentação." };
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/receitas");
}

export type DeleteMovementState = { error?: string } | undefined;

export async function deleteMovement(id: string): Promise<DeleteMovementState> {
  await requirePermission("canManageEstoque");

  try {
    await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.findUniqueOrThrow({
        where: { id },
        include: { ingredient: true },
      });

      const current = Number(movement.ingredient.currentStock);
      const quantity = Number(movement.quantity);
      if (movement.type === "ENTRADA" && quantity > current) {
        throw new Error(
          `Não dá pra excluir: removeria mais estoque do que existe hoje de ${movement.ingredient.name} (provavelmente esse estoque já foi usado em outras movimentações).`,
        );
      }

      await tx.ingredient.update({
        where: { id: movement.ingredientId },
        data: {
          currentStock:
            movement.type === "ENTRADA" ? { decrement: quantity } : { increment: quantity },
        },
      });

      await tx.stockMovement.delete({ where: { id } });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível excluir a movimentação.",
    };
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
  unitPrice: z.coerce.number().positive().optional(),
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
  items: { ingredientId: string; quantity: number; reason?: string; unitPrice?: number }[],
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
            // Preço efetivo dessa entrada: o informado agora, ou o já
            // cadastrado no ingrediente se deixado em branco — guardado
            // aqui pra "quanto comprei no mês" continuar certo mesmo que
            // o preço cadastrado mude depois.
            unitPriceAtEntry:
              parsed.data.type === "ENTRADA" ? (item.unitPrice ?? Number(ingredient.unitPrice)) : null,
          },
        });
        const newUnitPrice =
          parsed.data.type === "ENTRADA" && item.unitPrice !== undefined
            ? weightedAveragePrice(current, Number(ingredient.unitPrice), item.quantity, item.unitPrice)
            : undefined;
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            currentStock:
              parsed.data.type === "ENTRADA"
                ? { increment: item.quantity }
                : { decrement: item.quantity },
            ...(newUnitPrice !== undefined ? { unitPrice: newUnitPrice } : {}),
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
  revalidatePath("/receitas");

  return { count: parsed.data.items.length };
}
