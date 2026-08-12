"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const payableSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  category: z.string().trim().min(1, "Informe a categoria."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida."),
  storeId: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

export type PayableFormState = { error?: string } | undefined;

function parse(formData: FormData) {
  return payableSchema.safeParse({
    description: formData.get("description"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    storeId: formData.get("storeId") || undefined,
    note: formData.get("note") || undefined,
  });
}

export async function criarConta(
  _prev: PayableFormState,
  formData: FormData,
): Promise<PayableFormState> {
  const user = await requirePermission("canViewRelatorios");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const jaPaga = formData.get("jaPaga") === "on";
  const paidStr = String(formData.get("paidDate") || "");
  const paidDate = jaPaga
    ? /^\d{4}-\d{2}-\d{2}$/.test(paidStr)
      ? new Date(`${paidStr}T00:00:00Z`)
      : new Date(`${parsed.data.dueDate}T00:00:00Z`)
    : null;

  await prisma.payable.create({
    data: {
      description: parsed.data.description,
      category: parsed.data.category,
      amount: parsed.data.amount,
      dueDate: new Date(`${parsed.data.dueDate}T00:00:00Z`),
      storeId: parsed.data.storeId || null,
      note: parsed.data.note || null,
      status: jaPaga ? "PAGA" : "PENDENTE",
      paidDate,
      userId: user.id,
    },
  });
  revalidatePath("/caixa");
  return {};
}

export async function editarConta(
  id: string,
  _prev: PayableFormState,
  formData: FormData,
): Promise<PayableFormState> {
  await requirePermission("canViewRelatorios");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await prisma.payable.update({
    where: { id },
    data: {
      description: parsed.data.description,
      category: parsed.data.category,
      amount: parsed.data.amount,
      dueDate: new Date(`${parsed.data.dueDate}T00:00:00Z`),
      storeId: parsed.data.storeId || null,
      note: parsed.data.note || null,
    },
  });
  revalidatePath("/caixa");
  return {};
}

export async function lancarBoleto(input: {
  description: string;
  amount: number;
  dueDate: string;
}): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const desc = input.description?.trim() || "Boleto";
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Valor do boleto inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { error: "Vencimento inválido." };

  await prisma.payable.create({
    data: {
      description: desc,
      category: "Fornecedor",
      amount,
      dueDate: new Date(`${input.dueDate}T00:00:00Z`),
      status: "PENDENTE",
      note: "Lançado por leitura de boleto",
      userId: user.id,
    },
  });
  revalidatePath("/caixa");
  return {};
}

export async function marcarPaga(id: string, dataISO?: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  const paidDate =
    dataISO && /^\d{4}-\d{2}-\d{2}$/.test(dataISO)
      ? new Date(`${dataISO}T00:00:00Z`)
      : new Date();
  await prisma.payable.update({
    where: { id },
    data: { status: "PAGA", paidDate },
  });
  revalidatePath("/caixa");
  return {};
}

export async function reabrirConta(id: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  await prisma.payable.update({
    where: { id },
    data: { status: "PENDENTE", paidDate: null },
  });
  revalidatePath("/caixa");
  return {};
}

export async function excluirConta(id: string): Promise<{ error?: string }> {
  await requirePermission("canViewRelatorios");
  await prisma.payable.delete({ where: { id } });
  revalidatePath("/caixa");
  return {};
}
