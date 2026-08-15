"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const storeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da loja."),
  address: z.string().trim().max(300).optional(),
  latitude: z.coerce.number().min(-90).max(90, "Latitude inválida."),
  longitude: z.coerce.number().min(-180).max(180, "Longitude inválida."),
  radiusMeters: z.coerce.number().int().min(10, "O raio mínimo é 10 metros."),
  // Aceita colar com ou sem "Bearer " na frente; vazio = sem integração.
  saiposToken: z
    .string()
    .trim()
    .transform((v) => v.replace(/^Bearer\s+/i, "").trim())
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  pluggyClientId: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  pluggyClientSecret: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
});

export type StoreFormState = { error?: string } | undefined;

function parseStoreForm(formData: FormData) {
  return storeSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    radiusMeters: formData.get("radiusMeters"),
    saiposToken: formData.get("saiposToken") ?? "",
    pluggyClientId: formData.get("pluggyClientId") ?? "",
    pluggyClientSecret: formData.get("pluggyClientSecret") ?? "",
  });
}

export async function createStore(
  _prevState: StoreFormState,
  formData: FormData,
): Promise<StoreFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = parseStoreForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.store.create({ data: { ...parsed.data, companyId: user.companyId } });
  revalidatePath("/lojas");
}

export async function updateStore(
  id: string,
  _prevState: StoreFormState,
  formData: FormData,
): Promise<StoreFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = parseStoreForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await prisma.store.updateMany({
    where: { id, companyId: user.companyId },
    data: parsed.data,
  });
  if (result.count === 0) return { error: "Loja não encontrada." };
  revalidatePath("/lojas");
}

export async function deleteStore(id: string) {
  const user = await requirePermission("canManageFuncionarios");
  try {
    const result = await prisma.store.deleteMany({ where: { id, companyId: user.companyId } });
    if (result.count === 0) throw new Error("not found");
  } catch {
    throw new Error("Existem funcionários vinculados a essa loja. Mude o vínculo deles antes de excluir.");
  }
  revalidatePath("/lojas");
}
