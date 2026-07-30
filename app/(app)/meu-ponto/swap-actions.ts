"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";

async function getOwnEmployee(userId: string) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) throw new Error("Sua conta não está vinculada a um cadastro de funcionário.");
  return employee;
}

async function isFolgaDay(employeeId: string, weeklyDayOff: number | null, dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayOff = await prisma.dayOff.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  // "Trabalha" cancela a folga naquele dia específico, mesmo sendo a folga
  // fixa semanal (ex: a folga foi comprada ou remanejada pra outro dia).
  if (dayOff?.type === "TRABALHA") return false;
  const isWeekly = weeklyDayOff !== null && date.getDay() === weeklyDayOff;
  return isWeekly || dayOff?.type === "FOLGA";
}

const requestSwapSchema = z.object({
  targetEmployeeId: z.string().trim().min(1, "Selecione um colega."),
  requesterDate: z.string().trim().min(1, "Selecione sua folga."),
  targetDate: z.string().trim().min(1, "Selecione a folga do colega."),
  note: z.string().trim().max(300).optional(),
});

export type SwapFormState = { error?: string } | undefined;

export async function requestSwap(
  _prevState: SwapFormState,
  formData: FormData,
): Promise<SwapFormState> {
  const user = await requireUser();
  const requester = await getOwnEmployee(user.id);

  const parsed = requestSwapSchema.safeParse({
    targetEmployeeId: formData.get("targetEmployeeId"),
    requesterDate: formData.get("requesterDate"),
    targetDate: formData.get("targetDate"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.targetEmployeeId === requester.id) {
    return { error: "Você não pode trocar folga com você mesmo." };
  }

  const target = await prisma.employee.findUnique({ where: { id: parsed.data.targetEmployeeId } });
  if (!target || !target.active) {
    return { error: "Colega não encontrado." };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (parsed.data.requesterDate < todayStr || parsed.data.targetDate < todayStr) {
    return { error: "Só dá pra trocar datas futuras." };
  }

  const requesterOk = await isFolgaDay(requester.id, requester.weeklyDayOff, parsed.data.requesterDate);
  if (!requesterOk) {
    return { error: "A data escolhida não é sua folga." };
  }
  const targetOk = await isFolgaDay(target.id, target.weeklyDayOff, parsed.data.targetDate);
  if (!targetOk) {
    return { error: "A data escolhida não é folga desse colega." };
  }

  const duplicate = await prisma.shiftSwapRequest.findFirst({
    where: {
      requesterId: requester.id,
      targetId: target.id,
      requesterDate: new Date(`${parsed.data.requesterDate}T00:00:00`),
      targetDate: new Date(`${parsed.data.targetDate}T00:00:00`),
      status: { in: ["PENDENTE", "ACEITO_PELO_FUNCIONARIO"] },
    },
  });
  if (duplicate) {
    return { error: "Já existe uma solicitação em aberto pra essa troca." };
  }

  await prisma.shiftSwapRequest.create({
    data: {
      requesterId: requester.id,
      targetId: target.id,
      requesterDate: new Date(`${parsed.data.requesterDate}T00:00:00`),
      targetDate: new Date(`${parsed.data.targetDate}T00:00:00`),
      note: parsed.data.note,
    },
  });

  revalidatePath("/meu-ponto");
}

export async function respondToSwapAsEmployee(swapId: string, accept: boolean) {
  const user = await requireUser();
  const employee = await getOwnEmployee(user.id);

  const swap = await prisma.shiftSwapRequest.findUniqueOrThrow({ where: { id: swapId } });
  if (swap.targetId !== employee.id) {
    throw new Error("Essa solicitação não é sua.");
  }
  if (swap.status !== "PENDENTE") {
    throw new Error("Essa solicitação já foi respondida.");
  }

  await prisma.shiftSwapRequest.update({
    where: { id: swapId },
    data: {
      status: accept ? "ACEITO_PELO_FUNCIONARIO" : "RECUSADO_PELO_FUNCIONARIO",
      targetRespondedAt: new Date(),
    },
  });

  revalidatePath("/meu-ponto");
  revalidatePath("/funcionarios");
}

export async function cancelSwapRequest(swapId: string) {
  const user = await requireUser();
  const employee = await getOwnEmployee(user.id);

  const swap = await prisma.shiftSwapRequest.findUniqueOrThrow({ where: { id: swapId } });
  if (swap.requesterId !== employee.id) {
    throw new Error("Essa solicitação não é sua.");
  }
  if (swap.status !== "PENDENTE") {
    throw new Error("Só dá pra cancelar enquanto está pendente.");
  }

  await prisma.shiftSwapRequest.update({ where: { id: swapId }, data: { status: "CANCELADO" } });

  revalidatePath("/meu-ponto");
}
