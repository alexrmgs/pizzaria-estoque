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
  correctionGrossWeight: z.coerce.number().positive("Deve ser maior que zero.").nullable(),
  correctionNetWeight: z.coerce.number().positive("Deve ser maior que zero.").nullable(),
}).refine(
  (data) =>
    data.correctionGrossWeight === null ||
    data.correctionNetWeight === null ||
    data.correctionNetWeight <= data.correctionGrossWeight,
  { message: "O peso líquido não pode ser maior que o peso bruto.", path: ["correctionNetWeight"] },
);

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

  const grossRaw = formData.get("correctionGrossWeight");
  const correctionGrossWeight =
    typeof grossRaw === "string" && grossRaw.trim() !== "" ? grossRaw : null;
  const netRaw = formData.get("correctionNetWeight");
  const correctionNetWeight = typeof netRaw === "string" && netRaw.trim() !== "" ? netRaw : null;

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
    correctionGrossWeight,
    correctionNetWeight,
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
        correctionGrossWeight: parsed.data.correctionGrossWeight,
        correctionNetWeight: parsed.data.correctionNetWeight,
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
        correctionGrossWeight: parsed.data.correctionGrossWeight,
        correctionNetWeight: parsed.data.correctionNetWeight,
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

const recipeUnitSchema = z.object({
  recipeUnit: z.enum(UNITS).nullable(),
  unitsPerPackage: z.coerce.number().positive("Tem que ser maior que zero."),
});

/**
 * Atalho usado direto na tela de Receitas: define (ou ajusta) a conversão de
 * unidade de compra pra unidade de uso do ingrediente sem precisar abrir o
 * cadastro em Estoque. Continua exigindo `canManageEstoque` porque mexe no
 * cadastro mestre do ingrediente, não só na receita.
 */
export async function setIngredientRecipeUnit(
  id: string,
  recipeUnit: string | null,
  unitsPerPackage: number,
) {
  await requirePermission("canManageEstoque");

  const parsed = recipeUnitSchema.safeParse({ recipeUnit, unitsPerPackage });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  await prisma.ingredient.update({
    where: { id },
    data: { recipeUnit: parsed.data.recipeUnit, unitsPerPackage: parsed.data.unitsPerPackage },
  });

  revalidatePath("/estoque");
  revalidatePath("/receitas");
}

/**
 * Tira todos os itens "produzidos internamente" do cálculo do CMV de uma
 * vez — evita contar duas vezes (os insumos crus já entram no CMV quando
 * consumidos na produção; contar o item produzido também duplicaria).
 */
export async function excludeProducedFromCmv(): Promise<{ count: number }> {
  await requirePermission("canManageEstoque");

  const result = await prisma.ingredient.updateMany({
    where: { isProduced: true, includeInCmv: true },
    data: { includeInCmv: false },
  });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");

  return { count: result.count };
}

/**
 * Recalcula o "estoque aceitável" de todos os ingredientes com base no
 * consumo médio semanal real: soma a saída dos últimos 90 dias, divide pelo
 * tempo coberto (mesma conta usada na página do ingrediente) e aplica uma
 * folga de 20% em cima. Ingrediente sem saída registrada nos últimos 90 dias
 * fica de fora (não dá pra estimar consumo sem histórico).
 */
export async function recalcularEstoqueAceitavel(): Promise<{ atualizados: number; semHistorico: number }> {
  await requirePermission("canManageEstoque");

  const janelaInicio = new Date();
  janelaInicio.setDate(janelaInicio.getDate() - 90);

  const ingredients = await prisma.ingredient.findMany({
    where: { active: true },
    select: { id: true },
  });

  let atualizados = 0;
  let semHistorico = 0;

  for (const { id } of ingredients) {
    const saidas = await prisma.stockMovement.findMany({
      where: { ingredientId: id, type: "SAIDA", createdAt: { gte: janelaInicio } },
      orderBy: { createdAt: "asc" },
      select: { quantity: true, createdAt: true },
    });
    if (saidas.length === 0) {
      semHistorico += 1;
      continue;
    }
    const totalSaida = saidas.reduce((sum, m) => sum + Number(m.quantity), 0);
    const diasCobertos = Math.max(1, (Date.now() - saidas[0].createdAt.getTime()) / 86_400_000);
    const mediaSemanal = totalSaida / (diasCobertos / 7);
    // Arredonda pra cima em número fechado — não dá pra comprar "34,7kg" de
    // açúcar, então o valor final vira um inteiro comprável.
    const novoIdeal = Math.ceil(mediaSemanal * 1.2);

    await prisma.ingredient.update({ where: { id }, data: { idealStock: novoIdeal } });
    atualizados += 1;
  }

  revalidatePath("/estoque");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");

  return { atualizados, semHistorico };
}

/**
 * Ingrediente com movimentações, receitas etc. vinculadas não pode ser
 * excluído de verdade (quebraria o histórico) — nesse caso `blocked: true`
 * avisa o chamador pra oferecer arquivar em vez de excluir.
 */
export async function deleteIngredient(id: string): Promise<{ blocked?: boolean }> {
  await requirePermission("canManageEstoque");

  try {
    await prisma.ingredient.delete({ where: { id } });
  } catch {
    return { blocked: true };
  }

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");
  revalidatePath("/receitas");
  return {};
}

export async function setIngredientActive(id: string, active: boolean) {
  await requirePermission("canManageEstoque");

  await prisma.ingredient.update({ where: { id }, data: { active } });

  revalidatePath("/estoque");
  revalidatePath("/dashboard");
  revalidatePath("/lista-compras");
  revalidatePath("/producao");
  revalidatePath("/receitas");
}
