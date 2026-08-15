"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

// ---- Movimento (cédulas): entradas e saídas ----

const entradaSchema = z.object({
  date: dateISO,
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
});

export async function salvarEntrada(input: {
  date: string;
  description: string;
  amount: number;
}): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  await prisma.cashEntry.create({
    data: {
      date: new Date(`${parsed.data.date}T00:00:00Z`),
      description: parsed.data.description,
      direction: "ENTRADA",
      amount: parsed.data.amount,
      userId: user.id,
      companyId: user.companyId,
    },
  });
  revalidatePath("/caixa-dinheiro");
  return {};
}

const saidaSchema = entradaSchema.extend({
  tipo: z.enum(["PAGAMENTO", "FUNDO"]),
});

export async function salvarSaida(input: {
  date: string;
  description: string;
  amount: number;
  tipo: "PAGAMENTO" | "FUNDO";
}): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const parsed = saidaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  await prisma.cashEntry.create({
    data: {
      date: new Date(`${parsed.data.date}T00:00:00Z`),
      description: parsed.data.description,
      direction: "SAIDA",
      tipo: parsed.data.tipo,
      amount: parsed.data.amount,
      userId: user.id,
      companyId: user.companyId,
    },
  });
  revalidatePath("/caixa-dinheiro");
  return {};
}

export async function excluirEntrada(id: string): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  await prisma.cashEntry.deleteMany({ where: { id, companyId: user.companyId } });
  revalidatePath("/caixa-dinheiro");
  return {};
}

// ---- Controle de moedas ----

const moedaSchema = z.object({
  date: dateISO,
  direction: z.enum(["ENTRADA", "SAIDA"]),
  q05: z.coerce.number().int().min(0).default(0),
  q10: z.coerce.number().int().min(0).default(0),
  q25: z.coerce.number().int().min(0).default(0),
  q50: z.coerce.number().int().min(0).default(0),
  q100: z.coerce.number().int().min(0).default(0),
  note: z.string().trim().max(200).optional(),
});

export async function salvarMoedas(input: {
  date: string;
  direction: "ENTRADA" | "SAIDA";
  q05: number;
  q10: number;
  q25: number;
  q50: number;
  q100: number;
  note?: string;
}): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const parsed = moedaSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  if (d.q05 + d.q10 + d.q25 + d.q50 + d.q100 === 0) {
    return { error: "Informe a quantidade de pelo menos uma moeda." };
  }
  await prisma.coinMovement.create({
    data: {
      date: new Date(`${d.date}T00:00:00Z`),
      direction: d.direction,
      q05: d.q05,
      q10: d.q10,
      q25: d.q25,
      q50: d.q50,
      q100: d.q100,
      note: d.note || null,
      companyId: user.companyId,
    },
  });
  revalidatePath("/caixa-dinheiro");
  return {};
}

export async function excluirMoedas(id: string): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  await prisma.coinMovement.deleteMany({ where: { id, companyId: user.companyId } });
  revalidatePath("/caixa-dinheiro");
  return {};
}

// ---- Configuração do mês (saldo inicial, estoque inicial de moedas, virada) ----

const mesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido."),
  saldoInicial: z.coerce.number().default(0),
  saldoAnterior: z.coerce.number().optional(),
  ini05: z.coerce.number().int().min(0).default(0),
  ini10: z.coerce.number().int().min(0).default(0),
  ini25: z.coerce.number().int().min(0).default(0),
  ini50: z.coerce.number().int().min(0).default(0),
  ini100: z.coerce.number().int().min(0).default(0),
  cedulasContadas: z.coerce.number().optional(),
  moedasContadas: z.coerce.number().optional(),
});

export async function salvarMes(input: {
  month: string;
  saldoInicial: number;
  saldoAnterior?: number;
  ini05: number;
  ini10: number;
  ini25: number;
  ini50: number;
  ini100: number;
  cedulasContadas?: number;
  moedasContadas?: number;
}): Promise<{ error?: string }> {
  const user = await requirePermission("canViewRelatorios");
  const parsed = mesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  await prisma.cashMonth.upsert({
    where: { companyId_month: { companyId: user.companyId, month: d.month } },
    create: {
      companyId: user.companyId,
      month: d.month,
      saldoInicial: d.saldoInicial,
      saldoAnterior: d.saldoAnterior ?? null,
      ini05: d.ini05,
      ini10: d.ini10,
      ini25: d.ini25,
      ini50: d.ini50,
      ini100: d.ini100,
      cedulasContadas: d.cedulasContadas ?? null,
      moedasContadas: d.moedasContadas ?? null,
    },
    update: {
      saldoInicial: d.saldoInicial,
      saldoAnterior: d.saldoAnterior ?? null,
      ini05: d.ini05,
      ini10: d.ini10,
      ini25: d.ini25,
      ini50: d.ini50,
      ini100: d.ini100,
      cedulasContadas: d.cedulasContadas ?? null,
      moedasContadas: d.moedasContadas ?? null,
    },
  });
  revalidatePath("/caixa-dinheiro");
  return {};
}
