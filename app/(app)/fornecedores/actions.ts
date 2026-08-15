"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const fornecedorSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do fornecedor."),
  cnpj: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  note: z.string().trim().max(500).optional(),
  productIds: z.array(z.string().trim().min(1)),
});

export type FornecedorFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  return fornecedorSchema.safeParse({
    name: formData.get("name"),
    cnpj: formData.get("cnpj") || undefined,
    phone: formData.get("phone") || undefined,
    note: formData.get("note") || undefined,
    productIds: formData.getAll("productIds"),
  });
}

export async function createFornecedor(
  _prevState: FornecedorFormState,
  formData: FormData,
): Promise<FornecedorFormState> {
  await requirePermission("canManageEstoque");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { productIds, ...data } = parsed.data;
  try {
    await prisma.fornecedor.create({
      data: { ...data, products: { connect: productIds.map((id) => ({ id })) } },
    });
  } catch {
    return { error: "Já existe um fornecedor com esse nome." };
  }

  revalidatePath("/fornecedores");
  revalidatePath("/estoque");
  revalidatePath("/movimentacoes");
}

export async function updateFornecedor(
  id: string,
  _prevState: FornecedorFormState,
  formData: FormData,
): Promise<FornecedorFormState> {
  await requirePermission("canManageEstoque");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { productIds, ...data } = parsed.data;
  try {
    await prisma.fornecedor.update({
      where: { id },
      data: { ...data, products: { set: productIds.map((pid) => ({ id: pid })) } },
    });
  } catch {
    return { error: "Não foi possível atualizar esse fornecedor." };
  }

  revalidatePath("/fornecedores");
  revalidatePath("/estoque");
  revalidatePath("/movimentacoes");
}

export async function deleteFornecedor(id: string) {
  await requirePermission("canManageEstoque");
  await prisma.fornecedor.delete({ where: { id } });
  revalidatePath("/fornecedores");
  revalidatePath("/estoque");
  revalidatePath("/movimentacoes");
}
