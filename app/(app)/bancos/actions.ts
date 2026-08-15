"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  createConnectToken,
  getItem,
  getTransactions,
  atualizarItem,
  resolvePluggyCreds,
  type PluggyTransaction,
} from "@/lib/pluggy";

async function credsOuFalha(storeId: string, companyId: string) {
  const store = await prisma.store.findFirst({
    where: { id: storeId, companyId },
    select: { pluggyClientId: true, pluggyClientSecret: true },
  });
  const creds = resolvePluggyCreds(store);
  if (!creds) throw new Error("Essa loja ainda não tem Open Finance configurado (cadastre em Lojas).");
  return creds;
}

export async function novoConnectToken(storeId: string): Promise<{ token?: string; error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  try {
    const creds = await credsOuFalha(storeId, user.companyId);
    const token = await createConnectToken(creds);
    return { token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar a conexão." };
  }
}

export async function salvarConexao(itemId: string, storeId: string): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  if (!itemId?.trim()) return { error: "Conexão inválida." };
  if (!storeId?.trim()) return { error: "Selecione uma loja." };

  let name: string | null = null;
  try {
    const creds = await credsOuFalha(storeId, user.companyId);
    const item = await getItem(creds, itemId);
    name = item.connector?.name ?? null;
  } catch {
    // Se não conseguir o nome agora, salva mesmo assim.
  }

  await prisma.bankConnection.upsert({
    where: { itemId },
    create: { itemId, name, storeId },
    update: { name, storeId },
  });

  revalidatePath("/bancos");
  return {};
}

// Busca o extrato de uma conta só quando o usuário abre — deixa a tela Bancos
// carregar rápido (só saldos) e o extrato vem sob demanda.
export async function buscarExtrato(
  accountId: string,
  storeId: string,
): Promise<{ transactions?: PluggyTransaction[]; error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  try {
    const creds = await credsOuFalha(storeId, user.companyId);
    const transactions = await getTransactions(creds, accountId);
    return { transactions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao buscar o extrato." };
  }
}

// Força a atualização de todas as contas conectadas dessa loja na Pluggy
// (busca as movimentações novas no banco). Os dados novos levam alguns instantes.
export async function atualizarTudo(storeId: string): Promise<{ error?: string; qtd?: number }> {
  const user = await requirePermission("canViewRelatorios");
  const creds = await credsOuFalha(storeId, user.companyId);
  const conns = await prisma.bankConnection.findMany({ where: { storeId }, select: { itemId: true } });
  let qtd = 0;
  for (const c of conns) {
    try {
      await atualizarItem(creds, c.itemId);
      qtd++;
    } catch {
      // segue com as outras
    }
  }
  return { qtd };
}

export async function removerConexao(id: string): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const conn = await prisma.bankConnection.findUnique({ where: { id }, select: { storeId: true } });
  if (!conn?.storeId) return { error: "Conexão não encontrada." };
  const store = await prisma.store.findFirst({
    where: { id: conn.storeId, companyId: user.companyId },
    select: { id: true },
  });
  if (!store) return { error: "Conexão não encontrada." };
  await prisma.bankConnection.delete({ where: { id } });
  revalidatePath("/bancos");
  return {};
}
