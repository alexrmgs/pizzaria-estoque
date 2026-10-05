"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/dal";

const BRAZIL_UTC_OFFSET_HOURS = 3;

/** "2026-09-10" + "18:00" no horário de Brasília → instante UTC certo, seja qual for o fuso do servidor. */
function brazilDateTime(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + BRAZIL_UTC_OFFSET_HOURS, min));
}

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  situacao: z.enum(["TRABALHOU", "FALTA", "ATESTADO", "FOLGA", "LIMPAR"]),
  clockIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  obs: z.string().trim().max(300).optional(),
});

export type AjusteDiaState = { error?: string } | undefined;

/**
 * Ajusta um dia do espelho de ponto direto do relatório:
 * - TRABALHOU: corrige (ou lança) entrada/saída e tira falta/atestado/folga do dia.
 * - FALTA / ATESTADO / FOLGA: marca o dia e apaga o ponto batido nele.
 * - LIMPAR: apaga tudo do dia (fica "sem registro").
 */
export async function ajustarDiaPonto(employeeId: string, entryId: string | null, formData: FormData): Promise<AjusteDiaState> {
  await requireAccess("canManageFuncionarios", "/relatorio-ponto");

  const parsed = schema.safeParse({
    date: formData.get("date"),
    situacao: formData.get("situacao"),
    clockIn: formData.get("clockIn") || undefined,
    clockOut: formData.get("clockOut") || undefined,
    obs: formData.get("obs") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { date, situacao, clockIn, clockOut, obs } = parsed.data;
  const day = new Date(`${date}T00:00:00Z`);

  if (situacao === "TRABALHOU") {
    if (!clockIn) return { error: "Informe o horário de entrada." };
    const inAt = brazilDateTime(date, clockIn);
    let outAt = clockOut ? brazilDateTime(date, clockOut) : null;
    // Saída depois da meia-noite (ex: 18:00 → 00:30) é no dia seguinte.
    if (outAt && outAt <= inAt) outAt = new Date(outAt.getTime() + 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      if (entryId) {
        await tx.timeEntry.update({
          where: { id: entryId, employeeId },
          data: { clockIn: inAt, clockOut: outAt, note: obs ?? null },
        });
      } else {
        await tx.timeEntry.create({
          data: { employeeId, date: day, clockIn: inAt, clockOut: outAt, note: obs ?? null },
        });
      }
      await tx.dayOff.deleteMany({
        where: { employeeId, date: day, type: { in: ["FALTA", "ATESTADO", "FOLGA"] } },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.deleteMany({ where: { employeeId, date: day } });
      if (situacao === "LIMPAR") {
        await tx.dayOff.deleteMany({ where: { employeeId, date: day } });
      } else {
        await tx.dayOff.upsert({
          where: { employeeId_date: { employeeId, date: day } },
          create: { employeeId, date: day, type: situacao, reason: obs ?? null },
          update: { type: situacao, reason: obs ?? null },
        });
      }
    });
  }

  revalidatePath("/relatorio-ponto");
  revalidatePath("/ponto-equipe");
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/pagamentos");
  revalidatePath("/escalas");
}
