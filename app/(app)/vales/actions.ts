"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

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
        category: "Vale-comida",
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
        kind: "VALE",
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

