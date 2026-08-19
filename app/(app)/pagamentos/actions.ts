"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  admissionProrationFactor,
  SALARY_ADVANCE_RATE,
  SALARY_ADVANCE_TAG,
  todayInBrazil,
} from "@/lib/payroll";

/**
 * Adiantamento quinzenal (40% do salário) do dia 20 — é folha de pagamento,
 * não vale-comida: fica com identidade própria (kind ADIANTAMENTO) e vira
 * conta pendente em Contas a Pagar, vencimento no próprio dia 20.
 */
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
      kind: "ADIANTAMENTO",
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
        // trabalhados até agora — senão o adiantamento de 40% saía sobre o
        // salário cheio pra quem nem completou o mês ainda.
        const prorated =
          Number(employee.baseSalary) * admissionProrationFactor(employee.hireDate, monthEnd);
        const amount = prorated * SALARY_ADVANCE_RATE;

        const payable = await tx.payable.create({
          data: {
            description: `Adiantamento — ${employee.name} (40%)`,
            category: "Adiantamento salarial",
            amount,
            dueDate: day20,
            status: "PENDENTE",
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
            kind: "ADIANTAMENTO",
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
