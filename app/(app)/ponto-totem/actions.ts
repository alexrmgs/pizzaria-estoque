"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission } from "@/lib/dal";
import { todayInBrazil } from "@/lib/payroll";

const FACE_MATCH_THRESHOLD = 0.55;

/** Distância euclidiana entre dois descritores de rosto (128 números). Quanto
 * menor, mais parecidos. Abaixo do threshold consideramos a mesma pessoa. */
function faceDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function isDescriptor(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 128 && value.every((n) => typeof n === "number");
}

export async function saveFaceDescriptor(
  employeeId: string,
  descriptor: number[],
): Promise<{ error?: string }> {
  await requirePermission("canManageFuncionarios");
  if (!isDescriptor(descriptor)) return { error: "Leitura do rosto inválida. Tente de novo." };
  await prisma.employee.update({ where: { id: employeeId }, data: { faceDescriptor: descriptor } });
  revalidatePath("/ponto-totem");
  return {};
}

export async function removeFaceDescriptor(employeeId: string): Promise<{ error?: string }> {
  await requirePermission("canManageFuncionarios");
  await prisma.employee.update({ where: { id: employeeId }, data: { faceDescriptor: undefined } });
  revalidatePath("/ponto-totem");
  return {};
}

type FacialPontoResult =
  | { status: "ok"; employeeName: string; action: "entrada" | "saída"; time: string }
  | { status: "done"; employeeName: string }
  | { status: "unknown" }
  | { status: "error"; message: string };

export async function registerFacialPonto(descriptor: number[]): Promise<FacialPontoResult> {
  await requireUser();
  try {
    if (!isDescriptor(descriptor)) return { status: "error", message: "Leitura do rosto inválida." };

    const employees = await prisma.employee.findMany({
      where: { active: true, NOT: { faceDescriptor: { equals: undefined } } },
      select: { id: true, name: true, faceDescriptor: true },
    });

    let best: { id: string; name: string; distance: number } | null = null;
    for (const emp of employees) {
      if (!isDescriptor(emp.faceDescriptor)) continue;
      const distance = faceDistance(descriptor, emp.faceDescriptor);
      if (!best || distance < best.distance) best = { id: emp.id, name: emp.name, distance };
    }

    if (!best || best.distance > FACE_MATCH_THRESHOLD) return { status: "unknown" };

    const now = new Date();
    const date = todayInBrazil(now);

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId: best.id, clockOut: null },
      orderBy: { clockIn: "desc" },
    });

    if (openEntry) {
      await prisma.timeEntry.update({ where: { id: openEntry.id }, data: { clockOut: now } });
      revalidatePath("/ponto-equipe");
      return {
        status: "ok",
        employeeName: best.name,
        action: "saída",
        time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }),
      };
    }

    const todaysEntry = await prisma.timeEntry.findFirst({ where: { employeeId: best.id, date } });
    if (todaysEntry) return { status: "done", employeeName: best.name };

    await prisma.timeEntry.create({ data: { employeeId: best.id, date, clockIn: now } });
    revalidatePath("/ponto-equipe");
    return {
      status: "ok",
      employeeName: best.name,
      action: "entrada",
      time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }),
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Erro ao bater ponto." };
  }
}
