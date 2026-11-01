"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireUser, requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import {
  brazilTime,
  LATE_TOLERANCE_MINUTES,
  lateMinutes,
  SUSPEITA_SEM_ENTRADA_MINUTOS,
  todayInBrazil,
  TURNO_MAX_HORAS,
} from "@/lib/payroll";

const FACE_MATCH_THRESHOLD = 0.55;
// Quem continua na frente da câmera depois de bater não pode virar saída.
const REBATIDA_MINUTOS = 5;

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
  // Cadastro de rosto só pra quem administra o RH inteiro — quem tem só a
  // tela do Ponto por Facial (totem) apenas bate ponto.
  await requirePermission("canManageFuncionarios");
  if (!isDescriptor(descriptor)) return { error: "Leitura do rosto inválida. Tente de novo." };
  await prisma.employee.update({ where: { id: employeeId }, data: { faceDescriptor: descriptor } });
  revalidatePath("/ponto-totem");
  return {};
}

export async function removeFaceDescriptor(employeeId: string): Promise<{ error?: string }> {
  // Cadastro de rosto só pra quem administra o RH inteiro — quem tem só a
  // tela do Ponto por Facial (totem) apenas bate ponto.
  await requirePermission("canManageFuncionarios");
  await prisma.employee.update({
    where: { id: employeeId },
    // undefined o Prisma ignora (não apagava nada); DbNull grava NULL no campo.
    data: { faceDescriptor: Prisma.DbNull },
  });
  revalidatePath("/ponto-totem");
  return {};
}

type FacialPontoResult =
  | { status: "ok"; employeeName: string; action: "entrada" | "saída"; time: string; aviso?: string }
  | { status: "done"; employeeName: string }
  | { status: "recent"; employeeName: string }
  | { status: "unknown" }
  | { status: "error"; message: string };

function sanitizePhoto(photo: string | undefined): string | undefined {
  // Só aceita uma imagem JPEG em data URL e limita o tamanho, pra não deixar
  // gravarem qualquer coisa no banco.
  if (!photo || !photo.startsWith("data:image/jpeg;base64,")) return undefined;
  if (photo.length > 200_000) return undefined;
  return photo;
}

export async function registerFacialPonto(
  descriptor: number[],
  photo?: string,
): Promise<FacialPontoResult> {
  const totemUser = await requireUser();
  try {
    if (!isDescriptor(descriptor)) return { status: "error", message: "Leitura do rosto inválida." };

    const settings = await getAppSettings(totemUser.companyId);
    if (settings.pontoMode === "CELULAR") {
      return {
        status: "error",
        message: "O ponto está configurado pra ser batido pelo celular. Mude em Configurações pra usar a facial.",
      };
    }

    const safePhoto = sanitizePhoto(photo);

    const employees = await prisma.employee.findMany({
      where: { active: true, NOT: { faceDescriptor: { equals: undefined } } },
      select: { id: true, name: true, faceDescriptor: true, scheduledStart: true },
    });

    let best: { id: string; name: string; scheduledStart: string | null; distance: number } | null = null;
    for (const emp of employees) {
      if (!isDescriptor(emp.faceDescriptor)) continue;
      const distance = faceDistance(descriptor, emp.faceDescriptor);
      if (!best || distance < best.distance) {
        best = { id: emp.id, name: emp.name, scheduledStart: emp.scheduledStart, distance };
      }
    }

    if (!best || best.distance > FACE_MATCH_THRESHOLD) return { status: "unknown" };

    const now = new Date();
    const date = todayInBrazil(now);

    const openEntry = await prisma.timeEntry.findFirst({
      where: { employeeId: best.id, clockOut: null },
      orderBy: { clockIn: "desc" },
    });
    // Entrada aberta há mais que um turno é saída esquecida: a batida de hoje
    // é entrada nova (senão gravava um turno de 24h+ como se fosse trabalhado).
    const esquecida =
      openEntry && now.getTime() - openEntry.clockIn.getTime() > TURNO_MAX_HORAS * 60 * 60 * 1000;

    if (openEntry && !esquecida) {
      if (now.getTime() - openEntry.clockIn.getTime() < REBATIDA_MINUTOS * 60_000) {
        return { status: "recent", employeeName: best.name };
      }
      await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { clockOut: now, clockOutPhoto: safePhoto },
      });
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

    await prisma.timeEntry.create({
      data: { employeeId: best.id, date, clockIn: now, clockInPhoto: safePhoto },
    });
    revalidatePath("/ponto-equipe");

    const late = lateMinutes(best.scheduledStart, now);
    const avisos: string[] = [];
    if (esquecida) {
      const dia = openEntry.date.toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");
      avisos.push(`Você não bateu a saída de ${dia} (entrada ${brazilTime(openEntry.clockIn)}). Fale com a gerência.`);
    }
    if (late > SUSPEITA_SEM_ENTRADA_MINUTOS) {
      avisos.push(`Seu horário é ${best.scheduledStart}. Se esqueceu a entrada, fale com a gerência.`);
    } else if (late > LATE_TOLERANCE_MINUTES) {
      avisos.push(`Atraso de ${late} min.`);
    }

    return {
      status: "ok",
      employeeName: best.name,
      action: "entrada",
      time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }),
      aviso: avisos.join(" ") || undefined,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Erro ao bater ponto." };
  }
}
