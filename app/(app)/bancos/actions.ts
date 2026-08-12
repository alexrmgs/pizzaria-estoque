"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { createConnectToken, getItem } from "@/lib/pluggy";

export async function novoConnectToken(): Promise<{ token?: string; error?: string }> {
  await requirePermission("canViewRelatorios");
  try {
    const token = await createConnectToken();
    return { token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar a conexão." };
  }
}

export async function salvarConexao(itemId: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  if (!itemId?.trim()) return { error: "Conexão inválida." };

  let name: string | null = null;
  try {
    const item = await getItem(itemId);
    name = item.connector?.name ?? null;
  } catch {
    // Se não conseguir o nome agora, salva mesmo assim.
  }

  await prisma.bankConnection.upsert({
    where: { itemId },
    create: { itemId, name },
    update: { name },
  });

  revalidatePath("/bancos");
  return {};
}

export async function removerConexao(id: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  await prisma.bankConnection.delete({ where: { id } });
  revalidatePath("/bancos");
  return {};
}
