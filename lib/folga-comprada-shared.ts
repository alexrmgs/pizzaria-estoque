// Constantes da folga comprada que também são usadas no navegador (diálogo de
// fechamento de pagamento) — sem importar o Prisma. Ver lib/folga-comprada.ts.

export const FOLGA_COMPRADA_REASON = "Folga comprada (paga em dobro)";
export const FOLGA_PAGA_TAG = "Folga trabalhada em dobro";

export function isFolgaPaga(description: string | null | undefined) {
  return !!description?.startsWith(FOLGA_PAGA_TAG);
}

/**
 * Pagamento em dobro do dia: o dia em si já está pago no salário mensal,
 * então o acréscimo é só mais 1 salário-dia (salário ÷ 30).
 */
export function folgaCompradaValor(baseSalary: number) {
  return Math.round((baseSalary / 30) * 100) / 100;
}
