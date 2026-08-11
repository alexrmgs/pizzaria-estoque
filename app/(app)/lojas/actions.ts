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
  });
}

export async function createStore(
  _prevState: StoreFormState,
  formData: FormData,
): Promise<StoreFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseStoreForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.store.create({ data: parsed.data });
  revalidatePath("/lojas");
}

export async function updateStore(
  id: string,
  _prevState: StoreFormState,
  formData: FormData,
): Promise<StoreFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseStoreForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.store.update({ where: { id }, data: parsed.data });
  revalidatePath("/lojas");
}

export async function deleteStore(id: string) {
  await requirePermission("canManageFuncionarios");
  try {
    await prisma.store.delete({ where: { id } });
  } catch {
    throw new Error("Existem funcionários vinculados a essa loja. Mude o vínculo deles antes de excluir.");
  }
  revalidatePath("/lojas");
}
