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
