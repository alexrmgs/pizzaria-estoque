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

/**
 * Vale é dinheiro que já saiu do caixa na hora — por isso a conta gerada em
 * Contas Pagas já nasce paga (não pendente), com a data/forma do próprio vale.
 */
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

  const employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
  if (!employee) return { error: "Funcionário não encontrado." };

  const date = new Date(`${parsed.data.date}T00:00:00Z`);

  await prisma.$transaction(async (tx) => {
    const payable = await tx.payable.create({
      data: {
        description: `Vale — ${employee.name}${parsed.data.description ? ` (${parsed.data.description})` : ""}`,
        category: "Vale/Adiantamento",
        amount: parsed.data.amount,
        dueDate: date,
        status: "PAGA",
        paidDate: date,
        note: "Gerada pelo lançamento de vale",
        userId: user.id,
        companyId: user.companyId,
      },
    });
    await tx.advance.create({
      data: {
        employeeId: parsed.data.employeeId,
        date,
        amount: parsed.data.amount,
        description: parsed.data.description,
        payableId: payable.id,
        userId: user.id,
      },
    });
  });

  revalidatePath("/vales");
  revalidatePath(`/funcionarios/${parsed.data.employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");
}

export async function removeAdvance(id: string) {
  await requirePermission("canManageFuncionarios");
  const advance = await prisma.advance.delete({ where: { id, paymentId: null } });
  if (advance.payableId) {
    await prisma.payable.delete({ where: { id: advance.payableId } }).catch(() => {});
  }
  revalidatePath("/vales");
  revalidatePath(`/funcionarios/${advance.employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");
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
    await prisma.$transaction(async (tx) => {
      for (const employee of toCreate) {
        // Admitido no meio do mês recebe adiantamento proporcional aos dias
        // trabalhados até agora — senão o vale de 40% saía sobre o salário
        // cheio pra quem nem completou o mês ainda.
        const prorated =
          Number(employee.baseSalary) * admissionProrationFactor(employee.hireDate, monthEnd);
        const amount = prorated * SALARY_ADVANCE_RATE;

        const payable = await tx.payable.create({
          data: {
            description: `Vale — ${employee.name} (adiantamento 40%)`,
            category: "Vale/Adiantamento",
            amount,
            dueDate: day20,
            status: "PAGA",
            paidDate: day20,
            note: "Gerada pelo adiantamento em lote do dia 20",
            userId: user.id,
            companyId: user.companyId,
          },
        });
        await tx.advance.create({
          data: {
            employeeId: employee.id,
            date: day20,
            amount,
            description: SALARY_ADVANCE_TAG,
            payableId: payable.id,
            userId: user.id,
          },
        });
      }
    });
  }

  revalidatePath("/vales");
  revalidatePath("/funcionarios");
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");

  return { created: toCreate.length, skipped: alreadyGeneratedIds.size };
}
