"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const madrugadaSchema = z.object({
  employeeId: z.string().trim().min(1, "Selecione um funcionário."),
  date: z.string().trim().min(1, "Informe a data."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  description: z.string().trim().max(300).optional(),
});

export type MadrugadaFormState = { error?: string } | undefined;

/**
 * Pagamento fixo por madrugada trabalhada — não é o adicional noturno
 * automático (que já sai do ponto batido), é um valor à parte pra quem faz
 * extra na madrugada, pago avulso pelo botão "Pagar" (não entra na folha
 * mensal do funcionário).
 */
export async function createMadrugadaPayment(
  _prevState: MadrugadaFormState,
  formData: FormData,
): Promise<MadrugadaFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = madrugadaSchema.safeParse({
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

  await prisma.payrollAdjustment.create({
    data: {
      employeeId: parsed.data.employeeId,
      type: "MADRUGADA",
      date: new Date(`${parsed.data.date}T00:00:00Z`),
      amount: parsed.data.amount,
      description: parsed.data.description,
    },
  });

  revalidatePath("/madrugada");
  revalidatePath(`/funcionarios/${parsed.data.employeeId}`);
  revalidatePath("/pagamentos");
}

export async function removeMadrugadaPayment(id: string) {
  await requirePermission("canManageFuncionarios");
  const adjustment = await prisma.payrollAdjustment.delete({
    where: { id, paymentId: null, paidAt: null },
  });
  revalidatePath("/madrugada");
  revalidatePath(`/funcionarios/${adjustment.employeeId}`);
  revalidatePath("/pagamentos");
}

/**
 * Paga de uma vez todos os lançamentos de madrugada pendentes desse
 * funcionário — cria uma conta já paga em Contas Pagas (saiu do caixa agora)
 * e marca os lançamentos como pagos, zerando o pendente dele.
 */
export async function payMadrugadaForEmployee(employeeId: string): Promise<{ error?: string }> {
  const user = await requirePermission("canManageFuncionarios");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "Funcionário não encontrado." };

  const pending = await prisma.payrollAdjustment.findMany({
    where: { employeeId, type: "MADRUGADA", paymentId: null, paidAt: null },
  });
  if (pending.length === 0) return { error: "Nada pendente pra pagar." };

  const total = pending.reduce((sum, p) => sum + Number(p.amount), 0);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const payable = await tx.payable.create({
      data: {
        description: `Madrugada — ${employee.name} (${pending.length} lançamento${pending.length === 1 ? "" : "s"})`,
        category: "Madrugada",
        amount: total,
        dueDate: now,
        status: "PAGA",
        paidDate: now,
        note: "Gerada pelo pagamento de madrugada",
        userId: user.id,
        companyId: user.companyId,
      },
    });
    await tx.payrollAdjustment.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { paidAt: now, payableId: payable.id },
    });
  });

  revalidatePath("/madrugada");
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/caixa");
  return {};
}
