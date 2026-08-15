"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProducaoAccess } from "@/lib/dal";

const criarLoteSchema = z.object({
  ingredientId: z.string().trim().min(1, "Selecione o produto."),
  quantity: z.coerce.number().positive("O peso/quantidade deve ser maior que zero."),
  producaoISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de produção inválida."),
  validadeISO: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export type CriarLoteResult = { error?: string; id?: string };

/**
 * Cria a etiqueta de produção como um "lote": registra a entrada no estoque
 * (StockMovement) e o lote (StockLabel) na mesma transação — a etiqueta É o
 * comprovante da entrada, por isso nasce junto. O QR code impresso carrega o
 * id desse lote, e é o que a leitura na saída vai procurar pra dar baixa.
 */
export async function criarLote(input: {
  ingredientId: string;
  quantity: number;
  producaoISO: string;
  validadeISO?: string;
}): Promise<CriarLoteResult> {
  const user = await requireProducaoAccess();

  const parsed = criarLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { ingredientId, quantity, producaoISO, validadeISO } = parsed.data;

  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!ingredient) return { error: "Produto não encontrado." };

  const producedAt = new Date(`${producaoISO}T00:00:00Z`);
  const expiresAt = validadeISO ? new Date(`${validadeISO}T00:00:00Z`) : null;

  try {
    const label = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          ingredientId,
          type: "ENTRADA",
          quantity,
          reason: "Entrada por etiqueta de produção",
          userId: user.id,
        },
      });

      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: { increment: quantity } },
      });

      return tx.stockLabel.create({
        data: {
          ingredientId,
          quantity,
          producedAt,
          expiresAt,
          entradaMovementId: movement.id,
          createdById: user.id,
        },
      });
    });

    revalidatePath("/estoque");
    revalidatePath("/lotes");
    revalidatePath("/dashboard");
    revalidatePath("/lista-compras");
    return { id: label.id };
  } catch {
    return { error: "Não foi possível registrar a entrada." };
  }
}

export type LoteInfo = {
  id: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  producedAt: Date;
  expiresAt: Date | null;
  status: "ATIVO" | "BAIXADO";
  consumedAt: Date | null;
  consumedByName: string | null;
};

export async function buscarLote(id: string): Promise<LoteInfo | null> {
  await requireProducaoAccess();
  const label = await prisma.stockLabel.findUnique({
    where: { id },
    include: { ingredient: { select: { name: true, unit: true } }, consumedBy: { select: { name: true } } },
  });
  if (!label) return null;
  return {
    id: label.id,
    ingredientName: label.ingredient.name,
    unit: label.ingredient.unit,
    quantity: Number(label.quantity),
    producedAt: label.producedAt,
    expiresAt: label.expiresAt,
    status: label.status,
    consumedAt: label.consumedAt,
    consumedByName: label.consumedBy?.name ?? null,
  };
}

/**
 * Dá baixa no lote: registra a saída (StockMovement) com a mesma
 * quantidade/produto gravados na entrada e marca o lote como consumido. Não
 * bloqueia se o estoque atual for menor que o lote (pode ter tido ajuste
 * manual no meio do caminho) — só não deixa o estoque ir negativo.
 */
export async function darBaixaLote(id: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireProducaoAccess();

  const label = await prisma.stockLabel.findUnique({ where: { id }, include: { ingredient: true } });
  if (!label) return { error: "Lote não encontrado (QR inválido ou de outro sistema)." };
  if (label.status === "BAIXADO") {
    return { error: "Esse lote já foi baixado." };
  }

  const quantity = Number(label.quantity);

  try {
    await prisma.$transaction(async (tx) => {
      const current = Number(label.ingredient.currentStock);
      const baixa = Math.min(quantity, Math.max(current, 0));

      const movement = await tx.stockMovement.create({
        data: {
          ingredientId: label.ingredientId,
          type: "SAIDA",
          quantity: baixa,
          reason: "Saída por leitura de QR (lote de etiqueta)",
          userId: user.id,
        },
      });

      await tx.ingredient.update({
        where: { id: label.ingredientId },
        data: { currentStock: { decrement: baixa } },
      });

      await tx.stockLabel.update({
        where: { id },
        data: {
          status: "BAIXADO",
          consumedAt: new Date(),
          consumedById: user.id,
          saidaMovementId: movement.id,
        },
      });
    });
  } catch {
    return { error: "Não foi possível dar baixa nesse lote." };
  }

  revalidatePath("/estoque");
  revalidatePath("/lotes");
  revalidatePath("/dashboard");
  return { ok: true };
}
