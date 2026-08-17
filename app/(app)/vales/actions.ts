"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  admissionProrationFactor,
  SALARY_ADVANCE_RATE,
  SALARY_ADVANCE_TAG,
  todayInBrazil,
} from "@/lib/payroll";

const advanceSchema = z.object({
  employeeId: z.string().trim().min(1, "Selecione um funcionário."),
  date: z.string().trim().min(1, "Informe a data."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  description: z.string().trim().max(300).optional(),
});

export type AdvanceFormState = { error?: string } | undefined;

export async function createAdvance(
  _prevState: AdvanceFormState,
  formData: FormData,
): Promise<AdvanceFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = advanceSchema.safeParse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.advance.create({
    data: {
      employeeId: parsed.data.employeeId,
      date: new Date(`${parsed.data.date}T00:00:00Z`),
      amount: parsed.data.amount,
      description: parsed.data.description,
      userId: user.id,
    },
  });

  revalidatePath("/vales");
  revalidatePath(`/funcionarios/${parsed.data.employeeId}`);
  revalidatePath("/pagamentos");
}

export async function removeAdvance(id: string) {
  await requirePermission("canManageFuncionarios");
  const advance = await prisma.advance.delete({ where: { id, paymentId: null } });
  revalidatePath("/vales");
  revalidatePath(`/funcionarios/${advance.employeeId}`);
  revalidatePath("/pagamentos");
}

export async function generateSalaryAdvances(): Promise<{ created: number; skipped: number }> {
  const user = await requirePermission("canManageFuncionarios");

  const brazilToday = todayInBrazil();
  const monthStart = new Date(Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth() + 1, 0, 23, 59, 59),
  );
  const day20 = new Date(Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), 20));

  const employees = await prisma.employee.findMany({
    where: { active: true, baseSalary: { gt: 0 } },
  });

  const alreadyGenerated = await prisma.advance.findMany({
    where: {
      description: SALARY_ADVANCE_TAG,
      date: { gte: monthStart, lte: monthEnd },
      employeeId: { in: employees.map((e) => e.id) },
    },
    select: { employeeId: true },
  });
  const alreadyGeneratedIds = new Set(alreadyGenerated.map((a) => a.employeeId));

  const toCreate = employees.filter((e) => !alreadyGeneratedIds.has(e.id));

  if (toCreate.length > 0) {
    await prisma.advance.createMany({
      data: toCreate.map((employee) => {
        // Admitido no meio do mês recebe adiantamento proporcional aos dias
        // trabalhados até agora — senão o vale de 40% saía sobre o salário
        // cheio pra quem nem completou o mês ainda.
        const prorated =
          Number(employee.baseSalary) * admissionProrationFactor(employee.hireDate, monthEnd);
        return {
          employeeId: employee.id,
          date: day20,
          amount: prorated * SALARY_ADVANCE_RATE,
          description: SALARY_ADVANCE_TAG,
          userId: user.id,
        };
      }),
    });
  }

  revalidatePath("/vales");
  revalidatePath("/funcionarios");
  revalidatePath("/pagamentos");

  return { created: toCreate.length, skipped: alreadyGeneratedIds.size };
}
