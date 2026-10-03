"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { todayInBrazil } from "@/lib/payroll";
import {
  addWeeksISO,
  CICLO_SEMANAS,
  ESCALA_BASE,
  FERIADOS_TRABALHADOS,
  HORIZONTE_SEMANAS,
  primeiroNome,
  RODIZIO_REASON,
} from "@/lib/rodizio-domingos";

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

function revalidar() {
  revalidatePath("/escalas");
  revalidatePath("/meu-ponto");
  revalidatePath("/relatorio-ponto");
  revalidatePath("/dashboard");
}

/** Liga/desliga a folga de um funcionário num domingo (ajuste manual). */
export async function alternarDomingo(employeeId: string, dateISO: string) {
  await requirePermission("canManageFuncionarios");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || toDate(dateISO).getUTCDay() !== 0) {
    return { error: "Data inválida." };
  }
  const date = toDate(dateISO);
  const existing = await prisma.dayOff.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  if (existing?.type === "FOLGA") {
    await prisma.dayOff.delete({ where: { id: existing.id } });
  } else if (existing && existing.type !== "TRABALHA") {
    return { error: "Já tem falta/atestado lançado nesse dia." };
  } else {
    await prisma.dayOff.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, type: "FOLGA", reason: RODIZIO_REASON },
      update: { type: "FOLGA", reason: RODIZIO_REASON },
    });
  }
  revalidar();
  return {};
}

/**
 * Continua o rodízio: pra cada funcionário ativo, pega o último domingo de
 * folga dele e lança um a cada CICLO_SEMANAS até HORIZONTE_SEMANAS à frente.
 * Não mexe em dia que já tem qualquer registro (folga, falta, atestado...).
 */
async function gerar() {
  const todayISO = todayInBrazil().toISOString().slice(0, 10);
  const limiteISO = addWeeksISO(todayISO, HORIZONTE_SEMANAS);

  // Quem já folga todo domingo (folga fixa no domingo) não entra no rodízio.
  const elegiveis = await prisma.employee.findMany({
    where: { active: true, OR: [{ weeklyDayOff: null }, { weeklyDayOff: { not: 0 } }] },
    select: { id: true, name: true },
  });

  const folgas = await prisma.dayOff.findMany({
    where: { employeeId: { in: elegiveis.map((e) => e.id) }, type: "FOLGA" },
    select: { employeeId: true, date: true },
  });
  const ocupados = await prisma.dayOff.findMany({
    where: { employeeId: { in: elegiveis.map((e) => e.id) }, date: { gte: toDate(todayISO) } },
    select: { employeeId: true, date: true },
  });
  const ocupado = new Set(ocupados.map((d) => `${d.employeeId}|${d.date.toISOString().slice(0, 10)}`));

  const criar: { employeeId: string; date: Date; type: "FOLGA"; reason: string }[] = [];
  const semRodizio: string[] = [];
  for (const e of elegiveis) {
    const domingos = folgas
      .filter((f) => f.employeeId === e.id && f.date.getUTCDay() === 0)
      .map((f) => f.date.toISOString().slice(0, 10))
      .sort();
    const ultimo = domingos.at(-1);
    if (!ultimo) {
      semRodizio.push(e.name);
      continue;
    }
    for (let d = addWeeksISO(ultimo, CICLO_SEMANAS); d <= limiteISO; d = addWeeksISO(d, CICLO_SEMANAS)) {
      if (d < todayISO || ocupado.has(`${e.id}|${d}`)) continue;
      criar.push({ employeeId: e.id, date: toDate(d), type: "FOLGA", reason: RODIZIO_REASON });
    }
  }
  if (criar.length) await prisma.dayOff.createMany({ data: criar, skipDuplicates: true });
  return { criados: criar.length, semRodizio };
}

export async function gerarRodizio() {
  await requirePermission("canManageFuncionarios");
  const result = await gerar();
  revalidar();
  return result;
}

/** Lança a escala base (PDF de out/nov 2026) e já gera o rodízio pra frente. */
export async function importarEscalaBase() {
  await requirePermission("canManageFuncionarios");
  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, weeklyDayOff: true },
  });
  const porNome = new Map<string, typeof employees>();
  for (const e of employees) {
    const k = primeiroNome(e.name);
    porNome.set(k, [...(porNome.get(k) ?? []), e]);
  }

  const naoEncontrados: string[] = [];
  const ambiguos: string[] = [];
  for (const { date, nomes } of ESCALA_BASE) {
    for (const nome of nomes) {
      const achados = porNome.get(primeiroNome(nome)) ?? [];
      if (achados.length === 0) {
        naoEncontrados.push(nome);
        continue;
      }
      if (achados.length > 1) {
        ambiguos.push(nome);
        continue;
      }
      const e = achados[0];
      const d = toDate(date);
      const existing = await prisma.dayOff.findUnique({ where: { employeeId_date: { employeeId: e.id, date: d } } });
      if (!existing) {
        await prisma.dayOff.create({ data: { employeeId: e.id, date: d, type: "FOLGA", reason: RODIZIO_REASON } });
      }
    }
  }

  // Feriado na segunda: quem folga segunda trabalha nesse dia.
  for (const iso of FERIADOS_TRABALHADOS) {
    const d = toDate(iso);
    for (const e of employees.filter((x) => x.weeklyDayOff === d.getUTCDay())) {
      const existing = await prisma.dayOff.findUnique({ where: { employeeId_date: { employeeId: e.id, date: d } } });
      if (!existing) {
        await prisma.dayOff.create({
          data: { employeeId: e.id, date: d, type: "TRABALHA", reason: "Feriado — trabalha (folga remanejada/paga)" },
        });
      }
    }
  }

  const result = await gerar();
  revalidar();
  return { ...result, naoEncontrados, ambiguos };
}
