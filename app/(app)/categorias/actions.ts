"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
});

export type CategoryFormState = { error?: string } | undefined;

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requirePermission("canManageEstoque");

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.category.create({ data: { name: parsed.data.name } });
  } catch {
    return { error: "Já existe uma categoria com esse nome." };
  }

  revalidatePath("/categorias");
  revalidatePath("/estoque");
}

export async function deleteCategory(id: string) {
  await requirePermission("canManageEstoque");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categorias");
  revalidatePath("/estoque");
}
