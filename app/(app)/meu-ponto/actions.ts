"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { distanceMeters } from "@/lib/geo";
import {
  EARLY_CLOCK_IN_TOLERANCE_MINUTES,
  minutesBeforeScheduledStart,
  todayInBrazil,
  weekdayInBrazil,
} from "@/lib/payroll";

type Coords = { latitude: number; longitude: number } | null;

async function getOwnEmployee() {
  const user = await requireUser();
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    include: { store: true },
  });
  if (!employee) {
    throw new Error("Sua conta não está vinculada a um funcionário.");
  }
  return employee;
}

function checkLocation(
  store: { name: string; latitude: unknown; longitude: unknown; radiusMeters: number } | null,
  coords: Coords,
): number | null {
  if (!store) return null;

  if (!coords) {
    throw new Error(
      "Precisamos da sua localização pra confirmar que você está na loja. Permita o acesso à localização e tente de novo.",
    );
  }

  const distance = distanceMeters(
    coords.latitude,
    coords.longitude,
    Number(store.latitude),
    Number(store.longitude),
  );

  if (distance > store.radiusMeters) {
    throw new Error(
      `Você está a ${Math.round(distance)}m de "${store.name}" — o máximo permitido é ${store.radiusMeters}m. Aproxime-se da loja pra bater o ponto.`,
    );
  }

  return Math.round(distance);
}

export async function clockIn(coords: Coords) {
  const employee = await getOwnEmployee();

  const openEntry = await prisma.timeEntry.findFirst({
    where: { employeeId: employee.id, clockOut: null },
  });
  if (openEntry) {
    throw new Error("Você já bateu entrada e ainda não bateu saída.");
  }

  const now = new Date();
  const date = todayInBrazil(now);

  const todaysEntry = await prisma.timeEntry.findFirst({
    where: { employeeId: employee.id, date },
  });
  if (todaysEntry) {
    throw new Error(
      "Você já bateu ponto hoje. Se o horário estiver errado, peça pra um administrador corrigir.",
    );
  }

  const todaysDayOff = await prisma.dayOff.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  });
  // Só bloqueia em folga de verdade (fixa semanal ou avulsa). Atestado e
  // falta são registros administrativos (geralmente lançados depois do
  // fato) e não devem impedir o funcionário de bater ponto.
  const isWeeklyDayOff =
    employee.weeklyDayOff !== null && weekdayInBrazil(now) === employee.weeklyDayOff;
  const isWorkOverride = todaysDayOff?.type === "TRABALHA";
  const isFolga = !isWorkOverride && (todaysDayOff?.type === "FOLGA" || isWeeklyDayOff);
  if (isFolga) {
    throw new Error(
      "Hoje é sua folga — não dá pra bater ponto. Se isso está errado, fale com um administrador.",
    );
  }

  const earlyMinutes = minutesBeforeScheduledStart(employee.scheduledStart, now);
  if (earlyMinutes > EARLY_CLOCK_IN_TOLERANCE_MINUTES) {
    throw new Error(
      `Ainda não deu sua hora — você só pode bater entrada a partir de ${EARLY_CLOCK_IN_TOLERANCE_MINUTES} minutos antes do seu horário (${employee.scheduledStart}). Faltam ${earlyMinutes} minutos.`,
    );
  }

  const distance = checkLocation(employee.store, coords);

  await prisma.timeEntry.create({
    data: { employeeId: employee.id, date, clockIn: now, clockInDistanceM: distance },
  });

  revalidatePath("/meu-ponto");
}

export async function clockOut(coords: Coords) {
  const employee = await getOwnEmployee();

  const openEntry = await prisma.timeEntry.findFirst({
    where: { employeeId: employee.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!openEntry) {
    throw new Error("Você ainda não bateu entrada hoje.");
  }

  const distance = checkLocation(employee.store, coords);

  await prisma.timeEntry.update({
    where: { id: openEntry.id },
    data: { clockOut: new Date(), clockOutDistanceM: distance },
  });

  revalidatePath("/meu-ponto");
}
