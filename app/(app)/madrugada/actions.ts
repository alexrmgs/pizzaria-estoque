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
 * extra na madrugada. Acumula igual bônus/desconto e entra no fechamento do
 * pagamento do mês.
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
  const adjustment = await prisma.payrollAdjustment.delete({ where: { id, paymentId: null } });
  revalidatePath("/madrugada");
  revalidatePath(`/funcionarios/${adjustment.employeeId}`);
  revalidatePath("/pagamentos");
}
