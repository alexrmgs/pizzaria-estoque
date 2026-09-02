"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { computeRescisao } from "@/lib/rescisao";
import type { TaxBracket } from "@/lib/payroll";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const employeeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  role: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  baseSalary: z.coerce.number().min(0, "O salário não pode ser negativo."),
  dependents: z.coerce.number().int().min(0, "Não pode ser negativo.").default(0),
  hireDate: z.string().trim().optional(),
  scheduledStart: z
    .string()
    .trim()
    .refine((v) => v === "" || timePattern.test(v), "Horário de entrada inválido."),
  scheduledEnd: z
    .string()
    .trim()
    .refine((v) => v === "" || timePattern.test(v), "Horário de saída inválido."),
  weeklyDayOff: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : Number(value)))
    .nullable()
    .optional(),
  active: z.coerce.boolean(),
  carteiraAssinada: z.coerce.boolean(),
  userId: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .optional(),
  storeId: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .optional(),
});

export type EmployeeFormState = { error?: string } | undefined;

function parseEmployeeForm(formData: FormData) {
  return employeeSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role") || undefined,
    phone: formData.get("phone") || undefined,
    baseSalary: formData.get("baseSalary"),
    dependents: formData.get("dependents") || 0,
    hireDate: formData.get("hireDate") || undefined,
    scheduledStart: formData.get("scheduledStart") || "",
    scheduledEnd: formData.get("scheduledEnd") || "",
    weeklyDayOff: formData.get("weeklyDayOff"),
    active: formData.get("active") === "on",
    carteiraAssinada: formData.get("carteiraAssinada") === "on",
    userId: formData.get("userId"),
    storeId: formData.get("storeId"),
  });
}

export async function createEmployee(
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.employee.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        baseSalary: parsed.data.baseSalary,
        dependents: parsed.data.dependents,
        hireDate: parsed.data.hireDate ? new Date(`${parsed.data.hireDate}T00:00:00`) : null,
        scheduledStart: parsed.data.scheduledStart || null,
        scheduledEnd: parsed.data.scheduledEnd || null,
        weeklyDayOff: parsed.data.weeklyDayOff ?? null,
        active: parsed.data.active,
        carteiraAssinada: parsed.data.carteiraAssinada,
        userId: parsed.data.userId ?? null,
        storeId: parsed.data.storeId ?? null,
      },
    });
  } catch {
    return { error: "Essa conta de acesso já está vinculada a outro funcionário." };
  }

  revalidatePath("/funcionarios");
}

export async function updateEmployee(
  id: string,
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requirePermission("canManageFuncionarios");

  const parsed = parseEmployeeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.employee.update({
      where: { id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        baseSalary: parsed.data.baseSalary,
        dependents: parsed.data.dependents,
        hireDate: parsed.data.hireDate ? new Date(`${parsed.data.hireDate}T00:00:00`) : null,
        scheduledStart: parsed.data.scheduledStart || null,
        scheduledEnd: parsed.data.scheduledEnd || null,
        weeklyDayOff: parsed.data.weeklyDayOff ?? null,
        active: parsed.data.active,
        carteiraAssinada: parsed.data.carteiraAssinada,
        userId: parsed.data.userId ?? null,
        storeId: parsed.data.storeId ?? null,
      },
    });
  } catch {
    return { error: "Essa conta de acesso já está vinculada a outro funcionário." };
  }

  revalidatePath("/funcionarios");
  revalidatePath(`/funcionarios/${id}`);
}

export async function setEmployeeActive(id: string, active: boolean) {
  await requirePermission("canManageFuncionarios");

  await prisma.employee.update({ where: { id }, data: { active } });

  revalidatePath("/funcionarios");
  revalidatePath(`/funcionarios/${id}`);
  revalidatePath("/pagamentos");
  revalidatePath("/vales");
  revalidatePath("/dashboard");
}

export async function respondToSwapAsManager(swapId: string, approve: boolean) {
  const user = await requirePermission("canManageFuncionarios");

  const swap = await prisma.shiftSwapRequest.findUniqueOrThrow({
    where: { id: swapId },
    include: { requester: { select: { name: true } }, target: { select: { name: true } } },
  });
  if (swap.status !== "ACEITO_PELO_FUNCIONARIO") {
    throw new Error("Essa solicitação ainda não foi aceita pelo colega, ou já foi finalizada.");
  }

  if (!approve) {
    await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "RECUSADO_PELA_GERENCIA", managerId: user.id, managerRespondedAt: new Date() },
    });
    revalidatePath("/funcionarios");
    revalidatePath("/meu-ponto");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Marca TRABALHA no dia que cada um cedeu — não basta apagar um FOLGA
    // explícito, porque se a folga cedida era a fixa semanal (sem registro no
    // banco) ela continuaria valendo por padrão.
    await tx.dayOff.upsert({
      where: { employeeId_date: { employeeId: swap.requesterId, date: swap.requesterDate } },
      update: { type: "TRABALHA", reason: `Troca de folga com ${swap.target.name}` },
      create: {
        employeeId: swap.requesterId,
        date: swap.requesterDate,
        type: "TRABALHA",
        reason: `Troca de folga com ${swap.target.name}`,
      },
    });
    await tx.dayOff.upsert({
      where: { employeeId_date: { employeeId: swap.targetId, date: swap.targetDate } },
      update: { type: "TRABALHA", reason: `Troca de folga com ${swap.requester.name}` },
      create: {
        employeeId: swap.targetId,
        date: swap.targetDate,
        type: "TRABALHA",
        reason: `Troca de folga com ${swap.requester.name}`,
      },
    });
    await tx.dayOff.upsert({
      where: { employeeId_date: { employeeId: swap.requesterId, date: swap.targetDate } },
      update: { type: "FOLGA", reason: `Troca de folga com ${swap.target.name}` },
      create: {
        employeeId: swap.requesterId,
        date: swap.targetDate,
        type: "FOLGA",
        reason: `Troca de folga com ${swap.target.name}`,
      },
    });
    await tx.dayOff.upsert({
      where: { employeeId_date: { employeeId: swap.targetId, date: swap.requesterDate } },
      update: { type: "FOLGA", reason: `Troca de folga com ${swap.requester.name}` },
      create: {
        employeeId: swap.targetId,
        date: swap.requesterDate,
        type: "FOLGA",
        reason: `Troca de folga com ${swap.requester.name}`,
      },
    });
    await tx.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "APROVADO", managerId: user.id, managerRespondedAt: new Date() },
    });
  });

  revalidatePath("/funcionarios");
  revalidatePath("/meu-ponto");
  revalidatePath("/dashboard");
}

export async function deleteEmployee(id: string) {
  await requirePermission("canManageFuncionarios");

  try {
    // Apaga tudo que está ligado ao funcionário antes de excluí-lo. Ponto,
    // folgas e trocas de turno somem em cascata sozinhos; vales, ajustes e
    // pagamentos (que travam a exclusão) são apagados na ordem certa aqui —
    // vales/ajustes antes dos pagamentos, porque apontam pra eles.
    await prisma.$transaction([
      prisma.advance.deleteMany({ where: { employeeId: id } }),
      prisma.payrollAdjustment.deleteMany({ where: { employeeId: id } }),
      prisma.payment.deleteMany({ where: { employeeId: id } }),
      prisma.termination.deleteMany({ where: { employeeId: id } }),
      prisma.employee.delete({ where: { id } }),
    ]);
  } catch {
    throw new Error("Não foi possível excluir esse funcionário. Tente de novo.");
  }

  revalidatePath("/funcionarios");
  revalidatePath("/pagamentos");
  revalidatePath("/vales");
  revalidatePath("/dashboard");
}

// ---------- Rescisão ----------

export type TerminationPreviewData = {
  baseSalary: number;
  dependents: number;
  hireDate: string | null;
  suggestedLastVacationDate: string | null;
  pendingAdvancesTotal: number;
  pendingDiscountsTotal: number;
  pendingBonusesTotal: number;
  cltSettings: {
    inssBrackets: TaxBracket[];
    irrfBrackets: TaxBracket[];
    irrfDependentDeduction: number;
  };
};

export async function getTerminationPreview(
  employeeId: string,
): Promise<TerminationPreviewData | { error: string }> {
  const user = await requirePermission("canManageFuncionarios");

  const [employee, settings, advances, adjustments] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    getAppSettings(user.companyId),
    prisma.advance.findMany({ where: { employeeId, paymentId: null, terminationId: null } }),
    prisma.payrollAdjustment.findMany({ where: { employeeId, paymentId: null, terminationId: null } }),
  ]);
  if (!employee) return { error: "Funcionário não encontrado." };

  const pendingAdvancesTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const pendingDiscountsTotal = adjustments
    .filter((a) => a.type === "DESCONTO")
    .reduce((s, a) => s + Number(a.amount), 0);
  const pendingBonusesTotal = adjustments
    .filter((a) => a.type === "BONUS")
    .reduce((s, a) => s + Number(a.amount), 0);

  const hireDateStr = employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : null;

  return {
    baseSalary: Number(employee.baseSalary),
    dependents: employee.dependents,
    hireDate: hireDateStr,
    suggestedLastVacationDate: hireDateStr,
    pendingAdvancesTotal,
    pendingDiscountsTotal,
    pendingBonusesTotal,
    cltSettings: {
      inssBrackets: settings.inssBrackets as unknown as TaxBracket[],
      irrfBrackets: settings.irrfBrackets as unknown as TaxBracket[],
      irrfDependentDeduction: Number(settings.irrfDependentDeduction),
    },
  };
}

const terminationSchema = z.object({
  dismissalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de desligamento inválida."),
  reason: z.enum(["SEM_JUSTA_CAUSA", "PEDIDO_DEMISSAO", "JUSTA_CAUSA", "ACORDO"]),
  avisoPrevio: z.enum(["INDENIZADO", "TRABALHADO", "DISPENSADO"]).optional(),
  lastVacationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data do início do período de férias inválida."),
  fgtsBalance: z.coerce.number().min(0).default(0),
  applyAvisoNaoCumpridoDiscount: z.coerce.boolean(),
  applyPendingAdvancesDiscount: z.coerce.boolean(),
  applyPendingDiscountsDiscount: z.coerce.boolean(),
  applyInssDiscount: z.coerce.boolean(),
  applyIrrfDiscount: z.coerce.boolean(),
  jaPago: z.coerce.boolean(),
  formaPagamento: z.enum(["DINHEIRO", "PIX"]).optional(),
  note: z.string().trim().max(500).optional(),
});

export type TerminationFormState = { error?: string } | undefined;

/**
 * Calcula a rescisão (regras CLT padrão — ver lib/rescisao.ts), demite o
 * funcionário e cria a conta em Contas a Pagar (ou já paga, se marcado).
 * Vales/bônus/descontos ainda pendentes desse funcionário entram no cálculo
 * e ficam vinculados à rescisão, pra não sumirem sem serem contados (o
 * funcionário inativo some das telas de Pagamentos/Vales).
 */
export async function demitirComRescisao(
  employeeId: string,
  _prevState: TerminationFormState,
  formData: FormData,
): Promise<TerminationFormState> {
  const user = await requirePermission("canManageFuncionarios");

  const parsed = terminationSchema.safeParse({
    dismissalDate: formData.get("dismissalDate"),
    reason: formData.get("reason"),
    avisoPrevio: formData.get("avisoPrevio") || undefined,
    lastVacationDate: formData.get("lastVacationDate"),
    fgtsBalance: formData.get("fgtsBalance") || 0,
    applyAvisoNaoCumpridoDiscount: formData.get("applyAvisoNaoCumpridoDiscount") === "on",
    applyPendingAdvancesDiscount: formData.get("applyPendingAdvancesDiscount") === "on",
    applyPendingDiscountsDiscount: formData.get("applyPendingDiscountsDiscount") === "on",
    applyInssDiscount: formData.get("applyInssDiscount") === "on",
    applyIrrfDiscount: formData.get("applyIrrfDiscount") === "on",
    jaPago: formData.get("jaPago") === "on",
    formaPagamento: formData.get("formaPagamento") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "Funcionário não encontrado." };

  const dismissalDate = new Date(`${parsed.data.dismissalDate}T00:00:00Z`);
  const lastVacationDate = new Date(`${parsed.data.lastVacationDate}T00:00:00Z`);
  const hireDate = employee.hireDate ?? lastVacationDate;

  const [settings, advances, adjustments] = await Promise.all([
    getAppSettings(user.companyId),
    prisma.advance.findMany({ where: { employeeId, paymentId: null, terminationId: null } }),
    prisma.payrollAdjustment.findMany({ where: { employeeId, paymentId: null, terminationId: null } }),
  ]);
  const pendingAdvancesTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const pendingDiscountsTotal = adjustments
    .filter((a) => a.type === "DESCONTO")
    .reduce((s, a) => s + Number(a.amount), 0);
  const pendingBonusesTotal = adjustments
    .filter((a) => a.type === "BONUS")
    .reduce((s, a) => s + Number(a.amount), 0);

  const result = computeRescisao({
    baseSalary: Number(employee.baseSalary),
    hireDate,
    dismissalDate,
    reason: parsed.data.reason,
    avisoPrevio: parsed.data.avisoPrevio ?? null,
    lastVacationDate,
    fgtsBalance: parsed.data.fgtsBalance,
    pendingAdvances: pendingAdvancesTotal,
    pendingDiscounts: pendingDiscountsTotal,
    pendingBonuses: pendingBonusesTotal,
    applyAvisoNaoCumpridoDiscount: parsed.data.applyAvisoNaoCumpridoDiscount,
    applyPendingAdvancesDiscount: parsed.data.applyPendingAdvancesDiscount,
    applyPendingDiscountsDiscount: parsed.data.applyPendingDiscountsDiscount,
    applyInssDiscount: parsed.data.applyInssDiscount,
    applyIrrfDiscount: parsed.data.applyIrrfDiscount,
    dependents: employee.dependents,
    inssBrackets: settings.inssBrackets as unknown as TaxBracket[],
    irrfBrackets: settings.irrfBrackets as unknown as TaxBracket[],
    irrfDependentDeduction: Number(settings.irrfDependentDeduction),
  });

  await prisma.$transaction(async (tx) => {
    const due = new Date(dismissalDate);
    due.setUTCDate(due.getUTCDate() + 10);

    const payable = await tx.payable.create({
      data: {
        description: `Rescisão — ${employee.name}`,
        category: "Rescisão",
        amount: result.totalLiquido,
        dueDate: parsed.data.jaPago ? dismissalDate : due,
        status: parsed.data.jaPago ? "PAGA" : "PENDENTE",
        paidDate: parsed.data.jaPago ? dismissalDate : null,
        paymentMethod: parsed.data.jaPago ? parsed.data.formaPagamento || null : null,
        note: "Gerada pelo cálculo de rescisão",
        userId: user.id,
        companyId: user.companyId,
      },
    });

    const termination = await tx.termination.create({
      data: {
        companyId: user.companyId,
        employeeId,
        dismissalDate,
        reason: parsed.data.reason,
        avisoPrevio: parsed.data.avisoPrevio || null,
        lastVacationDate,
        baseSalary: employee.baseSalary,
        avisoPrevioDays: result.avisoPrevioDays,
        projectedEndDate: result.projectedEndDate,
        saldoSalario: result.saldoSalario,
        avisoIndenizadoValor: result.avisoIndenizadoValor,
        feriasVencidas: result.feriasVencidas,
        feriasProporcionais: result.feriasProporcionais,
        decimoTerceiro: result.decimoTerceiroProporcional,
        inssDeduzido: parsed.data.applyInssDiscount
          ? result.inssSaldoSalario + result.inssDecimoTerceiro
          : 0,
        irrfDeduzido: parsed.data.applyIrrfDiscount
          ? result.irrfSaldoSalario + result.irrfDecimoTerceiro
          : 0,
        adiantamentosDeduzidos:
          (parsed.data.applyPendingAdvancesDiscount ? pendingAdvancesTotal : 0) +
          (parsed.data.applyPendingDiscountsDiscount ? pendingDiscountsTotal : 0),
        descontoAvisoNaoCumprido: result.descontoAvisoNaoCumprido,
        totalLiquido: result.totalLiquido,
        fgtsBalanceInformado: parsed.data.fgtsBalance,
        multaFgts: result.multaFgts,
        jaPago: parsed.data.jaPago,
        formaPagamento: parsed.data.jaPago ? parsed.data.formaPagamento || null : null,
        payableId: payable.id,
        note: parsed.data.note || null,
        userId: user.id,
      },
    });

    if (advances.length > 0) {
      await tx.advance.updateMany({
        where: { id: { in: advances.map((a) => a.id) } },
        data: { terminationId: termination.id },
      });
    }
    if (adjustments.length > 0) {
      await tx.payrollAdjustment.updateMany({
        where: { id: { in: adjustments.map((a) => a.id) } },
        data: { terminationId: termination.id },
      });
    }

    await tx.employee.update({ where: { id: employeeId }, data: { active: false } });
  });

  revalidatePath("/funcionarios");
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/vales");
  revalidatePath("/caixa");
  revalidatePath("/dashboard");
}
