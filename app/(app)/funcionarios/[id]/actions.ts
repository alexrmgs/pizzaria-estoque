"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { computePaymentPreview, type PaymentPreview } from "@/lib/payment-preview";
import { getAppSettings } from "@/lib/settings";
import {
  faltaAmount,
  inssAmount,
  irrfAmount,
  nthBusinessDayOfMonth,
  valeTransporteAmount,
} from "@/lib/payroll";

function combineDateTime(date: string, time: string, baseDate?: Date) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(year, month - 1, day, hour, minute);
  if (baseDate && result < baseDate) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// ---------- Time entries (ponto) ----------

const timeEntrySchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  clockIn: z.string().trim().min(1, "Informe o horário de entrada."),
  clockOut: z.string().trim().optional(),
  note: z.string().trim().max(300).optional(),
});

export type TimeEntryFormState = { error?: string } | undefined;

export async function addTimeEntry(
  employeeId: string,
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = timeEntrySchema.safeParse({
    date: formData.get("date"),
    clockIn: formData.get("clockIn"),
    clockOut: formData.get("clockOut") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00`);
  const clockIn = combineDateTime(parsed.data.date, parsed.data.clockIn);
  const clockOut = parsed.data.clockOut
    ? combineDateTime(parsed.data.date, parsed.data.clockOut, clockIn)
    : null;

  if (clockOut && clockOut <= clockIn) {
    return { error: "O horário de saída deve ser depois da entrada." };
  }

  await prisma.timeEntry.create({
    data: { employeeId, date, clockIn, clockOut, note: parsed.data.note },
  });

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/ponto-equipe");
}

export async function editTimeEntry(
  employeeId: string,
  id: string,
  _prevState: TimeEntryFormState,
  formData: FormData,
): Promise<TimeEntryFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = timeEntrySchema.safeParse({
    date: formData.get("date"),
    clockIn: formData.get("clockIn"),
    clockOut: formData.get("clockOut") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00`);
  const clockIn = combineDateTime(parsed.data.date, parsed.data.clockIn);
  const clockOut = parsed.data.clockOut
    ? combineDateTime(parsed.data.date, parsed.data.clockOut, clockIn)
    : null;

  if (clockOut && clockOut <= clockIn) {
    return { error: "O horário de saída deve ser depois da entrada." };
  }

  await prisma.timeEntry.update({
    where: { id },
    data: { date, clockIn, clockOut, note: parsed.data.note },
  });

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/ponto-equipe");
}

export async function deleteTimeEntry(employeeId: string, id: string) {
  await requirePermission("canManageFuncionarios");
  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/ponto-equipe");
}

// ---------- Folgas (day off) ----------

const dayOffSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  type: z.enum(["FOLGA", "ATESTADO", "FALTA", "TRABALHA"]),
  reason: z.string().trim().max(300).optional(),
});

export type DayOffFormState = { error?: string } | undefined;

export async function addDayOff(
  employeeId: string,
  _prevState: DayOffFormState,
  formData: FormData,
): Promise<DayOffFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = dayOffSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type") || "FOLGA",
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const date = new Date(`${parsed.data.date}T00:00:00`);

  try {
    await prisma.dayOff.create({
      data: { employeeId, date, type: parsed.data.type, reason: parsed.data.reason },
    });
  } catch {
    return { error: "Já existe um registro nesse dia." };
  }

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/escalas");
  revalidatePath("/meu-ponto");
}

export async function deleteDayOff(employeeId: string, id: string) {
  await requirePermission("canManageFuncionarios");
  await prisma.dayOff.delete({ where: { id } });
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/escalas");
  revalidatePath("/meu-ponto");
}

// ---------- Vales (advances) ----------

const advanceSchema = z.object({
  date: z.string().trim().min(1, "Informe a data."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  description: z.string().trim().max(300).optional(),
});

export type AdvanceFormState = { error?: string } | undefined;

export async function addAdvance(
  employeeId: string,
  _prevState: AdvanceFormState,
  formData: FormData,
): Promise<AdvanceFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = advanceSchema.safeParse({
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "Funcionário não encontrado." };

  const date = new Date(`${parsed.data.date}T00:00:00`);

  await prisma.$transaction(async (tx) => {
    const payable = await tx.payable.create({
      data: {
        description: `Vale — ${employee.name}${parsed.data.description ? ` (${parsed.data.description})` : ""}`,
        category: "Vale",
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
        employeeId,
        date,
        amount: parsed.data.amount,
        description: parsed.data.description,
        kind: "VALE",
        payableId: payable.id,
        userId: user.id,
      },
    });
  });

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/vales");
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");
}

export async function deleteAdvance(employeeId: string, id: string) {
  await requirePermission("canManageFuncionarios");
  const advance = await prisma.advance.delete({ where: { id, paymentId: null } });
  if (advance.payableId) {
    await prisma.payable.delete({ where: { id: advance.payableId } }).catch(() => {});
  }
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/vales");
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");
}

// ---------- Bônus / Descontos ----------

const adjustmentSchema = z.object({
  type: z.enum(["BONUS", "DESCONTO"]),
  date: z.string().trim().min(1, "Informe a data."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  description: z.string().trim().max(300).optional(),
});

export type AdjustmentFormState = { error?: string } | undefined;

export async function addAdjustment(
  employeeId: string,
  _prevState: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = adjustmentSchema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.payrollAdjustment.create({
    data: {
      employeeId,
      type: parsed.data.type,
      date: new Date(`${parsed.data.date}T00:00:00`),
      amount: parsed.data.amount,
      description: parsed.data.description,
    },
  });

  revalidatePath(`/funcionarios/${employeeId}`);
}

export async function deleteAdjustment(employeeId: string, id: string) {
  await requirePermission("canManageFuncionarios");
  await prisma.payrollAdjustment.delete({ where: { id, paymentId: null } });
  revalidatePath(`/funcionarios/${employeeId}`);
}

// ---------- Fechamento de pagamento ----------

export async function getPaymentPreview(
  employeeId: string,
  periodStartStr: string,
  periodEndStr: string,
): Promise<PaymentPreview | { error: string }> {
  const user = await requirePermission("canManageFuncionarios");

  const periodStart = new Date(`${periodStartStr}T00:00:00Z`);
  const periodEnd = new Date(`${periodEndStr}T00:00:00Z`);
  if (periodEnd < periodStart) {
    return { error: "O período final deve ser depois do inicial." };
  }

  return computePaymentPreview(employeeId, periodStart, periodEnd, user.companyId);
}

const closePaymentSchema = z.object({
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  baseSalary: z.coerce.number().min(0),
  applyInss: z.coerce.boolean(),
  applyIrrf: z.coerce.boolean(),
  applyVt: z.coerce.boolean(),
  faltaDays: z.coerce.number().min(0).default(0),
  applyAttendanceBonus: z.coerce.boolean(),
  note: z.string().trim().max(500).optional(),
  jaPago: z.coerce.boolean(),
  formaPagamento: z.enum(["DINHEIRO", "PIX"]).optional(),
  dataPagamento: z.string().trim().optional(),
});

export type ClosePaymentFormState = { error?: string } | undefined;

export async function closePayment(
  employeeId: string,
  _prevState: ClosePaymentFormState,
  formData: FormData,
): Promise<ClosePaymentFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = closePaymentSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    baseSalary: formData.get("baseSalary"),
    applyInss: formData.get("applyInss"),
    applyIrrf: formData.get("applyIrrf"),
    applyVt: formData.get("applyVt"),
    faltaDays: formData.get("faltaDays") || 0,
    applyAttendanceBonus: formData.get("applyAttendanceBonus"),
    note: formData.get("note") || undefined,
    jaPago: formData.get("jaPago") === "on",
    formaPagamento: formData.get("formaPagamento") || undefined,
    dataPagamento: formData.get("dataPagamento") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const periodStart = new Date(`${parsed.data.periodStart}T00:00:00Z`);
  const periodEnd = new Date(`${parsed.data.periodEnd}T00:00:00Z`);

  const overlapping = await prisma.payment.findFirst({
    where: { employeeId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
    orderBy: { periodStart: "asc" },
  });
  if (overlapping) {
    const fmt = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
    return {
      error: `Já existe um pagamento fechado cobrindo esse período (${fmt(overlapping.periodStart)} a ${fmt(overlapping.periodEnd)}). Desfaça esse pagamento antes de fechar de novo pra evitar duplicar.`,
    };
  }

  const [preview, employee, settings] = await Promise.all([
    getPaymentPreview(employeeId, parsed.data.periodStart, parsed.data.periodEnd),
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    getAppSettings(user.companyId),
  ]);
  if ("error" in preview) {
    return { error: preview.error };
  }

  // O campo "salário base do período" já vem proporcional quando o funcionário
  // foi admitido no meio do mês (prefill no diálogo), então usa como veio.
  const baseSalary = parsed.data.baseSalary;

  const grossForTax = baseSalary + preview.nightPremium + preview.overtimeAmount;
  const faltaVal = parsed.data.faltaDays > 0 ? faltaAmount(baseSalary, parsed.data.faltaDays) : 0;
  const inssVal = parsed.data.applyInss
    ? inssAmount(grossForTax, settings.inssBrackets as unknown as { upTo: number | null; rate: number }[])
    : 0;
  const irrfVal = parsed.data.applyIrrf
    ? irrfAmount(
        grossForTax,
        inssVal,
        employee.dependents,
        Number(settings.irrfDependentDeduction),
        settings.irrfBrackets as unknown as { upTo: number | null; rate: number }[],
      )
    : 0;
  const vtVal = parsed.data.applyVt
    ? valeTransporteAmount(baseSalary, Number(settings.valeTransporteRate))
    : 0;
  const attendanceBonusVal = parsed.data.applyAttendanceBonus ? preview.attendanceBonusAmount : 0;

  const netAmount =
    baseSalary +
    preview.nightPremium +
    preview.overtimeAmount +
    preview.bonusTotal +
    attendanceBonusVal -
    preview.discountTotal -
    preview.advancesTotal -
    preview.lateDiscountAmount -
    faltaVal -
    inssVal -
    irrfVal -
    vtVal;

  // Pago no 5º dia útil do mês seguinte ao período fechado (padrão do ciclo
  // mensal já usado no resto da tela), a menos que já tenha sido pago agora.
  const dueDate = nthBusinessDayOfMonth(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 5);
  const paidDate = parsed.data.jaPago
    ? parsed.data.dataPagamento
      ? new Date(`${parsed.data.dataPagamento}T00:00:00Z`)
      : new Date()
    : null;

  try {
    await prisma.$transaction(async (tx) => {
      const raceOverlap = await tx.payment.findFirst({
        where: { employeeId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
      });
      if (raceOverlap) {
        throw new Error("__DUPLICATE_PAYMENT__");
      }

      const periodLabel = `${parsed.data.periodStart.split("-").reverse().join("/")} a ${parsed.data.periodEnd.split("-").reverse().join("/")}`;
      const payable = await tx.payable.create({
        data: {
          description: `Folha — ${employee.name} (${periodLabel})`,
          category: "Folha de Pagamento",
          amount: netAmount,
          dueDate: paidDate ?? dueDate,
          status: parsed.data.jaPago ? "PAGA" : "PENDENTE",
          paidDate,
          paymentMethod: parsed.data.jaPago ? parsed.data.formaPagamento || null : null,
          note: "Gerada pelo fechamento de pagamento",
          userId: user.id,
          companyId: user.companyId,
        },
      });

      const payment = await tx.payment.create({
        data: {
          employeeId,
          periodStart,
          periodEnd,
          baseSalary,
          nightPremium: preview.nightPremium,
          overtimeHours: preview.overtimeHours,
          overtimeAmount: preview.overtimeAmount,
          bankedHours: preview.bankedHours,
          lateDiscountMinutes: preview.lateDiscountMinutes,
          lateDiscountAmount: preview.lateDiscountAmount,
          faltaDays: parsed.data.faltaDays,
          faltaAmount: faltaVal,
          inssAmount: inssVal,
          irrfAmount: irrfVal,
          valeTransporteAmount: vtVal,
          bonusTotal: preview.bonusTotal,
          discountTotal: preview.discountTotal,
          advancesTotal: preview.advancesTotal,
          attendanceScore: preview.attendanceScore,
          attendanceStreakMonths: preview.attendanceStreakMonths,
          attendanceBonusAmount: attendanceBonusVal,
          netAmount,
          note: parsed.data.note,
          payableId: payable.id,
          userId: user.id,
        },
      });

      const adjustmentIds = [...preview.bonusItems, ...preview.discountItems].map((i) => i.id);
      if (adjustmentIds.length > 0) {
        await tx.payrollAdjustment.updateMany({
          where: { id: { in: adjustmentIds } },
          data: { paymentId: payment.id },
        });
      }

      const advanceIds = preview.advanceItems.map((i) => i.id);
      if (advanceIds.length > 0) {
        await tx.advance.updateMany({
          where: { id: { in: advanceIds } },
          data: { paymentId: payment.id },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "__DUPLICATE_PAYMENT__") {
      return {
        error: "Esse período acabou de ser fechado em outro pagamento. Recarregue a página e confira.",
      };
    }
    throw error;
  }

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/caixa");
}

/**
 * Desfaz um pagamento já fechado: solta os vales e bônus/descontos que
 * tinham sido vinculados a ele (voltam a ficar pendentes), apaga a conta
 * gerada em Contas a Pagar/Pagas e o registro do pagamento. Assim o admin
 * corrige o que precisar e fecha de novo pelo fluxo normal, em vez de editar
 * valores soltos que podem ficar inconsistentes com o total.
 */
export async function reopenPayment(employeeId: string, paymentId: string) {
  await requirePermission("canManageFuncionarios");

  await prisma.$transaction(async (tx) => {
    await tx.payrollAdjustment.updateMany({
      where: { paymentId },
      data: { paymentId: null },
    });
    await tx.advance.updateMany({
      where: { paymentId },
      data: { paymentId: null },
    });
    const payment = await tx.payment.delete({ where: { id: paymentId, employeeId } });
    if (payment.payableId) {
      await tx.payable.delete({ where: { id: payment.payableId } }).catch(() => {});
    }
  });

  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/vales");
  revalidatePath("/caixa");
}
