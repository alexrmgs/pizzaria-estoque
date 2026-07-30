"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const holidaySchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  name: z.string().trim().min(1, "Informe o nome do feriado."),
});

export type HolidayFormState = { error?: string } | undefined;

export async function addHoliday(
  _prevState: HolidayFormState,
  formData: FormData,
): Promise<HolidayFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = holidaySchema.safeParse({
    date: formData.get("date"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00`);

  try {
    await prisma.holiday.create({ data: { date, name: parsed.data.name } });
  } catch {
    return { error: "Já existe um feriado cadastrado nessa data." };
  }

  revalidatePath("/feriados");
  revalidatePath("/pagamentos");
}

export async function deleteHoliday(id: string) {
  await requirePermission("canManageFuncionarios");
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/feriados");
  revalidatePath("/pagamentos");
}
