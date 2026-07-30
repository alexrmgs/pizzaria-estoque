"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const recipeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da receita."),
  type: z.enum(["PRODUCAO", "PIZZA", "BEIRUTE", "ESFIHA"]),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(5000).optional(),
  imageUrl: z
    .string()
    .trim()
    .max(4_000_000, "Imagem muito grande — escolha uma foto menor.")
    .optional()
    .transform((v) => (v ? v : null)),
  yieldKg: z.coerce.number().positive("O rendimento deve ser maior que zero.").nullable(),
  ingredientId: z
    .array(z.string().trim().min(1, "Selecione um ingrediente."))
    .min(1, "Adicione ao menos um ingrediente."),
  quantity: z.array(z.coerce.number().positive("A quantidade deve ser maior que zero.")),
  wastePercent: z.array(z.coerce.number().min(0).max(99, "A perda deve ser menor que 100%.")),
});

export type RecipeFormState = { error?: string } | undefined;

function parseRecipeForm(formData: FormData) {
  const yieldKgRaw = formData.get("yieldKg");
  const yieldKg = typeof yieldKgRaw === "string" && yieldKgRaw.trim() !== "" ? yieldKgRaw : null;
  const ingredientId = formData.getAll("ingredientId");
  const wastePercentRaw = formData.getAll("wastePercent");

  return recipeSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    description: formData.get("description") || undefined,
    instructions: formData.get("instructions") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    yieldKg,
    ingredientId,
    quantity: formData.getAll("quantity"),
    wastePercent: ingredientId.map((_, index) => wastePercentRaw[index] || "0"),
  });
}

export async function createRecipe(
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requirePermission("canManageReceitas");

  const parsed = parseRecipeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { name, type, description, instructions, imageUrl, yieldKg, ingredientId, quantity, wastePercent } =
    parsed.data;

  await prisma.recipe.create({
    data: {
      name,
      type,
      description,
      instructions,
      imageUrl,
      yieldKg,
      ingredients: {
        create: ingredientId.map((id, index) => ({
          ingredientId: id,
          quantity: quantity[index],
          wastePercent: wastePercent[index],
        })),
      },
    },
  });

  revalidatePath("/receitas");
}

export async function updateRecipe(
  id: string,
  _prevState: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requirePermission("canManageReceitas");

  const parsed = parseRecipeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { name, type, description, instructions, imageUrl, yieldKg, ingredientId, quantity, wastePercent } =
    parsed.data;

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.update({
      where: { id },
      data: {
        name,
        type,
        description,
        instructions,
        imageUrl,
        yieldKg,
        ingredients: {
          create: ingredientId.map((ingId, index) => ({
            ingredientId: ingId,
            quantity: quantity[index],
            wastePercent: wastePercent[index],
          })),
        },
      },
    }),
  ]);

  revalidatePath("/receitas");
}

export async function deleteRecipe(id: string) {
  await requirePermission("canManageReceitas");
  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/receitas");
}
