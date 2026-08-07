"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const fixedCostSchema = z.object({
  storeId: z.string().trim().min(1, "Selecione uma loja."),
  category: z.string().trim().min(1, "Informe a categoria."),
  referenceMonth: z.string().trim().regex(/^\d{4}-\d{2}$/, "Informe o mês."),
  amount: z.coerce.number().nonnegative("O valor não pode ser negativo."),
  note: z.string().trim().max(300).optional(),
});

export type FixedCostFormState = { error?: string } | undefined;

export async function upsertFixedCost(
  _prevState: FixedCostFormState,
  formData: FormData,
): Promise<FixedCostFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = fixedCostSchema.safeParse({
    storeId: formData.get("storeId"),
    category: formData.get("category"),
    referenceMonth: formData.get("referenceMonth"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.fixedCost.upsert({
    where: {
      storeId_category_referenceMonth: {
        storeId: parsed.data.storeId,
        category: parsed.data.category,
        referenceMonth: new Date(`${parsed.data.referenceMonth}-01T00:00:00Z`),
      },
    },
    create: {
      storeId: parsed.data.storeId,
      category: parsed.data.category,
      referenceMonth: new Date(`${parsed.data.referenceMonth}-01T00:00:00Z`),
      amount: parsed.data.amount,
      note: parsed.data.note,
      userId: user.id,
    },
    update: {
      amount: parsed.data.amount,
      note: parsed.data.note,
      userId: user.id,
    },
  });

  revalidatePath("/precificacao");
}

export async function removeFixedCost(id: string) {
  await requirePermission("canViewRelatorios");
  await prisma.fixedCost.delete({ where: { id } });
  revalidatePath("/precificacao");
}

export async function updateFixedCost(id: string, amount: number, note: string | null) {
  await requirePermission("canViewRelatorios");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Valor inválido.");
  await prisma.fixedCost.update({ where: { id }, data: { amount, note } });
  revalidatePath("/precificacao");
}

const variableCostSchema = z.object({
  storeId: z.string().trim().min(1, "Selecione uma loja."),
  category: z.string().trim().min(1, "Informe a categoria."),
  percentage: z.coerce.number().nonnegative("O percentual não pode ser negativo."),
});

export type VariableCostFormState = { error?: string } | undefined;

export async function upsertVariableCostRate(
  _prevState: VariableCostFormState,
  formData: FormData,
): Promise<VariableCostFormState> {
  const user = await requirePermission("canViewRelatorios");

  const parsed = variableCostSchema.safeParse({
    storeId: formData.get("storeId"),
    category: formData.get("category"),
    percentage: formData.get("percentage"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.variableCostRate.upsert({
    where: {
      storeId_category: {
        storeId: parsed.data.storeId,
        category: parsed.data.category,
      },
    },
    create: {
      storeId: parsed.data.storeId,
      category: parsed.data.category,
      percentage: parsed.data.percentage,
      userId: user.id,
    },
    update: {
      percentage: parsed.data.percentage,
      userId: user.id,
    },
  });

  revalidatePath("/precificacao");
}

export async function removeVariableCostRate(id: string) {
  await requirePermission("canViewRelatorios");
  await prisma.variableCostRate.delete({ where: { id } });
  revalidatePath("/precificacao");
}

export async function updateVariableCostRate(id: string, percentage: number) {
  await requirePermission("canViewRelatorios");
  if (!Number.isFinite(percentage) || percentage < 0) throw new Error("Percentual inválido.");
  await prisma.variableCostRate.update({ where: { id }, data: { percentage } });
  revalidatePath("/precificacao");
}

export async function updateRecipeCurrentPrice(recipeId: string, price: number | null) {
  await requirePermission("canViewRelatorios");
  if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error("Preço inválido.");
  await prisma.recipe.update({ where: { id: recipeId }, data: { currentPrice: price } });
  revalidatePath("/precificacao");
}
