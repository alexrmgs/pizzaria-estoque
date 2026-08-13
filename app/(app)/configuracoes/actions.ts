"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const settingsSchema = z.object({
  overtimeMode: z.enum(["HORA_EXTRA", "BANCO_HORAS"]),
  dailyExpectedHours: z.coerce.number().positive("A jornada deve ser maior que zero."),
  overtimeRate: z.coerce.number().min(1, "O multiplicador deve ser ao menos 1."),
});

export type SettingsFormState = { error?: string } | undefined;

export async function updateSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = settingsSchema.safeParse({
    overtimeMode: formData.get("overtimeMode"),
    dailyExpectedHours: formData.get("dailyExpectedHours"),
    overtimeRate: formData.get("overtimeRate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: parsed.data,
    create: { id: "settings", ...parsed.data },
  });

  revalidatePath("/configuracoes");
}

export async function updateLabelSize(
  widthMm: number,
  heightMm: number,
  tipo: "pedido" | "producao" = "pedido",
): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  const w = Math.round(widthMm);
  const h = Math.round(heightMm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 20 || w > 200 || h < 20 || h > 200) {
    return { error: "A largura e a altura devem ficar entre 20 e 200 mm." };
  }
  const data =
    tipo === "producao"
      ? { labelProducaoWidthMm: w, labelProducaoHeightMm: h }
      : { labelWidthMm: w, labelHeightMm: h };
  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: data,
    create: { id: "settings", ...data },
  });
  revalidatePath("/configuracoes");
  revalidatePath("/etiquetas");
  revalidatePath("/etiquetas-producao");
  return {};
}

export async function updateLabelEmpresa(input: {
  empresa: string;
  cnpj: string;
  endereco: string;
  cep: string;
  cidade: string;
}): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  const clean = (v: string) => v.trim().slice(0, 120) || null;
  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: {
      labelEmpresa: clean(input.empresa),
      labelCnpj: clean(input.cnpj),
      labelEndereco: clean(input.endereco),
      labelCep: clean(input.cep),
      labelCidade: clean(input.cidade),
    },
    create: {
      id: "settings",
      labelEmpresa: clean(input.empresa),
      labelCnpj: clean(input.cnpj),
      labelEndereco: clean(input.endereco),
      labelCep: clean(input.cep),
      labelCidade: clean(input.cidade),
    },
  });
  revalidatePath("/configuracoes");
  revalidatePath("/etiquetas-producao");
  return {};
}

export async function updatePontoMode(mode: "CELULAR" | "FACIAL"): Promise<{ error?: string }> {
  await requirePermission("canManageFuncionarios");
  if (mode !== "CELULAR" && mode !== "FACIAL") return { error: "Opção inválida." };
  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: { pontoMode: mode },
    create: { id: "settings", pontoMode: mode },
  });
  revalidatePath("/configuracoes");
  revalidatePath("/meu-ponto");
  revalidatePath("/ponto-totem");
  return {};
}

const bracketRateSchema = z.coerce.number().min(0).max(100);

const cltDeductionsSchema = z.object({
  inssUpTo: z.array(z.string()),
  inssRate: z.array(bracketRateSchema),
  irrfUpTo: z.array(z.string()),
  irrfRate: z.array(bracketRateSchema),
  irrfDependentDeduction: z.coerce.number().min(0),
  valeTransporteRate: z.coerce.number().min(0).max(100),
});

export type CltDeductionsFormState = { error?: string } | undefined;

function parseBrackets(upTos: string[], rates: number[]) {
  return upTos.map((upToStr, i) => ({
    upTo: upToStr.trim() === "" ? null : Number(upToStr),
    rate: rates[i] / 100,
  }));
}

export async function updateCltDeductions(
  _prevState: CltDeductionsFormState,
  formData: FormData,
): Promise<CltDeductionsFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = cltDeductionsSchema.safeParse({
    inssUpTo: formData.getAll("inssUpTo"),
    inssRate: formData.getAll("inssRate"),
    irrfUpTo: formData.getAll("irrfUpTo"),
    irrfRate: formData.getAll("irrfRate"),
    irrfDependentDeduction: formData.get("irrfDependentDeduction"),
    valeTransporteRate: formData.get("valeTransporteRate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.inssUpTo.length === 0 || parsed.data.irrfUpTo.length === 0) {
    return { error: "Cada tabela precisa ter ao menos uma faixa." };
  }

  const inssBrackets = parseBrackets(parsed.data.inssUpTo, parsed.data.inssRate);
  const irrfBrackets = parseBrackets(parsed.data.irrfUpTo, parsed.data.irrfRate);

  if (inssBrackets[inssBrackets.length - 1].upTo === null) {
    return { error: "A última faixa do INSS precisa ter um teto (o INSS tem valor máximo de desconto)." };
  }

  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: {
      inssBrackets,
      irrfBrackets,
      irrfDependentDeduction: parsed.data.irrfDependentDeduction,
      valeTransporteRate: parsed.data.valeTransporteRate,
    },
    create: {
      id: "settings",
      inssBrackets,
      irrfBrackets,
      irrfDependentDeduction: parsed.data.irrfDependentDeduction,
      valeTransporteRate: parsed.data.valeTransporteRate,
    },
  });

  revalidatePath("/configuracoes");
}

const attendanceScoreSchema = z.object({
  latePenaltyPoints: z.coerce.number().int().min(0).max(100),
  tierMinScore: z.array(z.coerce.number().int().min(0).max(100)),
  tierBonus: z.array(z.coerce.number().min(0)),
  streakMonths: z.array(z.coerce.number().int().min(0)),
  streakMultiplier: z.array(z.coerce.number().min(0)),
});

export type AttendanceScoreFormState = { error?: string } | undefined;

export async function updateAttendanceScoreSettings(
  _prevState: AttendanceScoreFormState,
  formData: FormData,
): Promise<AttendanceScoreFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = attendanceScoreSchema.safeParse({
    latePenaltyPoints: formData.get("latePenaltyPoints"),
    tierMinScore: formData.getAll("tierMinScore"),
    tierBonus: formData.getAll("tierBonus"),
    streakMonths: formData.getAll("streakMonths"),
    streakMultiplier: formData.getAll("streakMultiplier"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.tierMinScore.length === 0) {
    return { error: "Adicione ao menos uma faixa de bônus." };
  }
  if (parsed.data.streakMonths.length === 0) {
    return { error: "Adicione ao menos uma faixa de sequência." };
  }

  const attendanceBonusTiers = parsed.data.tierMinScore.map((minScore, i) => ({
    minScore,
    bonus: parsed.data.tierBonus[i],
  }));
  const attendanceStreakTiers = parsed.data.streakMonths.map((months, i) => ({
    months,
    multiplier: parsed.data.streakMultiplier[i],
  }));

  await prisma.appSettings.upsert({
    where: { id: "settings" },
    update: {
      latePenaltyPoints: parsed.data.latePenaltyPoints,
      attendanceBonusTiers,
      attendanceStreakTiers,
    },
    create: {
      id: "settings",
      latePenaltyPoints: parsed.data.latePenaltyPoints,
      attendanceBonusTiers,
      attendanceStreakTiers,
    },
  });

  revalidatePath("/configuracoes");
}
