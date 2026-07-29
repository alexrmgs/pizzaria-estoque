"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const UNITS = ["KG", "G", "L", "ML", "UN", "PECA", "FARDO", "PCT", "CX"] as const;

const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do ingrediente."),
  unit: z.enum(UNITS, { message: "Selecione uma unidade válida." }),
  unitPrice: z.coerce.number().min(0, "O preço não pode ser negativo."),
  minStock: z.coerce.number().min(0, "O estoque mínimo não pode ser negativo."),
  idealStock: z.coerce.number().min(0, "O estoque aceitável não pode ser negativo.").nullable(),
  includeInCmv: z.coerce.boolean(),
  isProduced: z.coerce.boolean(),
  categoryId: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .optional(),
  recipeUnit: z
    .enum(UNITS)
    .nullable()
    .optional(),
  unitsPerPackage: z.coerce.number().positive("Tem que ser maior que zero.").default(1),
});

export type IngredientFormState = { error?: string } | undefined;

function parseIngredientForm(formData: FormData) {
  const idealStockRaw = formData.get("idealStock");
  const idealStock =
    typeof idealStockRaw === "string" && idealStockRaw.trim() !== "" ? idealStockRaw : null;

  const recipeUnitRaw = formData.get("recipeUnit");
  const recipeUnit =
    typeof recipeUnitRaw === "string" && recipeUnitRaw !== "" && recipeUnitRaw !== "same"
      ? recipeUnitRaw
      : null;

  return ingredientSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
    minStock: formData.get("minStock"),
    idealStock,
    includeInCmv: formData.get("includeInCmv") === "on",
    isProduced: formData.get("isProduced") === "on",
    categoryId: formData.get("categoryId"),
    recipeUnit,
    unitsPerPackage: formData.get("unitsPerPackage") || 1,
  });
}

export async function createIngredient(
  _prevState: IngredientFormState,
  formData: FormData,
): Promise<IngredientFormState> {
  await requirePermission("canManageEstoque");

  const parsed = parseIngredientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.ingredient.create({
      data: {
        name: parsed.data.name,
        unit: parsed.data.unit,
        unitPrice: parsed.data.unitPrice,
        minStock: parsed.data.minStock,
        idealStock: parsed.data.idealStock,
        includeInCmv: parsed.data.includeInCmv,
        isProduced: parsed.data.isProduced,
        categoryId: parsed.data.categoryId ?? null,
        recipeUnit: parsed.data.recipeUnit ?? null,
        unitsPerPackage: parsed.data.unitsPerPackage,
      },
    });
  } catch {
    return { error: "Já existe um ingrediente com esse nome." };
  }

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");
  revalidatePath("/receitas");
}

export async function updateIngredient(
  id: string,
  _prevState: IngredientFormState,
  formData: FormData,
): Promise<IngredientFormState> {
  await requirePermission("canManageEstoque");

  const parsed = parseIngredientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.ingredient.update({
      where: { id },
      data: {
        name: parsed.data.name,
        unit: parsed.data.unit,
        unitPrice: parsed.data.unitPrice,
        minStock: parsed.data.minStock,
        idealStock: parsed.data.idealStock,
        includeInCmv: parsed.data.includeInCmv,
        isProduced: parsed.data.isProduced,
        categoryId: parsed.data.categoryId ?? null,
        recipeUnit: parsed.data.recipeUnit ?? null,
        unitsPerPackage: parsed.data.unitsPerPackage,
      },
    });
  } catch {
    return { error: "Não foi possível atualizar este ingrediente." };
  }

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");
  revalidatePath("/receitas");
}

export async function deleteIngredient(id: string) {
  await requirePermission("canManageEstoque");

  try {
    await prisma.ingredient.delete({ where: { id } });
  } catch {
    throw new Error(
      "Esse ingrediente já tem movimentações ou receitas vinculadas e não pode ser excluído.",
    );
  }

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");
  revalidatePath("/receitas");
}
