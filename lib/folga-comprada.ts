import { prisma } from "@/lib/prisma";

// Folga comprada: o funcionário estava de folga (domingo do rodízio ou folga
// semanal) e trabalhou sem ganhar outra folga no lugar. Pela Lei 605/49
// (art. 9º) e Súmula 146 do TST, esse dia é pago em dobro, sem prejuízo do
// repouso já incluso no salário mensal. Como o dia já está pago no salário,
// o acréscimo no contracheque é de mais 1 salário-dia (salário ÷ 30). É verba salarial: entra na base de
// INSS/IRRF/FGTS.
//
// Fica guardado como DayOff TRABALHA (cancela a folga naquele dia) + um
// PayrollAdjustment BONUS com a descrição marcada, que entra sozinho no
// próximo fechamento de pagamento.

import { FOLGA_COMPRADA_REASON, FOLGA_PAGA_TAG, folgaCompradaValor } from "@/lib/folga-comprada-shared";

export { FOLGA_COMPRADA_REASON, FOLGA_PAGA_TAG, folgaCompradaValor, isFolgaPaga } from "@/lib/folga-comprada-shared";

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const br = (iso: string) => iso.split("-").reverse().join("/");

export async function comprarFolga(employeeId: string, dateISO: string, obs?: string) {
  const date = toDate(dateISO);
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const valor = folgaCompradaValor(Number(employee.baseSalary));
  const reason = obs ? `${FOLGA_COMPRADA_REASON} — ${obs}` : FOLGA_COMPRADA_REASON;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dayOff.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (existing && (existing.type === "FALTA" || existing.type === "ATESTADO")) {
      throw new Error("Já tem falta/atestado lançado nesse dia.");
    }
    await tx.dayOff.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, type: "TRABALHA", reason },
      update: { type: "TRABALHA", reason },
    });
    const jaLancado = await tx.payrollAdjustment.findFirst({
      where: { employeeId, date, type: "BONUS", description: { startsWith: FOLGA_PAGA_TAG } },
    });
    if (!jaLancado) {
      await tx.payrollAdjustment.create({
        data: {
          employeeId,
          date,
          type: "BONUS",
          amount: valor,
          description: `${FOLGA_PAGA_TAG} — ${br(dateISO)} (Lei 605/49, art. 9º)`,
        },
      });
    }
  });
}

/**
 * Desfaz a compra: tira o provento (se ainda não entrou num pagamento
 * fechado) e o registro do dia. Devolve erro se o pagamento já foi fechado —
 * aí tem que reabrir o pagamento antes.
 */
export async function desfazerCompra(employeeId: string, dateISO: string) {
  const date = toDate(dateISO);
  const adj = await prisma.payrollAdjustment.findFirst({
    where: { employeeId, date, type: "BONUS", description: { startsWith: FOLGA_PAGA_TAG } },
  });
  if (adj && (adj.paymentId || adj.paidAt)) {
    throw new Error("Essa folga comprada já entrou num pagamento fechado — reabra o pagamento antes.");
  }
  await prisma.$transaction(async (tx) => {
    if (adj) await tx.payrollAdjustment.delete({ where: { id: adj.id } });
    await tx.dayOff.deleteMany({
      where: { employeeId, date, type: "TRABALHA", reason: { startsWith: FOLGA_COMPRADA_REASON } },
    });
  });
}
