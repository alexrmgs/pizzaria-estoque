"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  createConnectToken,
  getItem,
  getTransactions,
  atualizarItem,
  type PluggyTransaction,
} from "@/lib/pluggy";

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

// Busca o extrato de uma conta só quando o usuário abre — deixa a tela Bancos
// carregar rápido (só saldos) e o extrato vem sob demanda.
export async function buscarExtrato(
  accountId: string,
): Promise<{ transactions?: PluggyTransaction[]; error?: string }> {
  await requirePermission("canViewRelatorios");
  try {
    const transactions = await getTransactions(accountId);
    return { transactions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao buscar o extrato." };
  }
}

// Força a atualização de todas as contas conectadas na Pluggy (busca as
// movimentações novas no banco). Os dados novos levam alguns instantes.
export async function atualizarTudo(): Promise<{ error?: string; qtd?: number }> {
  await requirePermission("canViewRelatorios");
  const conns = await prisma.bankConnection.findMany({ select: { itemId: true } });
  let qtd = 0;
  for (const c of conns) {
    try {
      await atualizarItem(c.itemId);
      qtd++;
    } catch {
      // segue com as outras
    }
  }
  return { qtd };
}

export async function removerConexao(id: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  await prisma.bankConnection.delete({ where: { id } });
  revalidatePath("/bancos");
  return {};
}
