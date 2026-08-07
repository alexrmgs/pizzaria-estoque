/**
 * Preço sugerido pelo método do "divisor de markup": dado o custo direto
 * (CMV) de uma receita e o total de custos fixos + variáveis + lucro
 * embutidos como % do preço de venda, o preço que faz essa % bater é
 * custo / (1 - percentualTotal/100) — não custo * (1 + percentualTotal/100),
 * porque os custos incidem sobre o preço final, não sobre o custo.
 */
export function computeSuggestedPrice(unitCost: number, totalMarkupPercent: number | null): number | null {
  if (totalMarkupPercent === null) return null;
  const divisor = 1 - totalMarkupPercent / 100;
  if (divisor <= 0) return null;
  return unitCost / divisor;
}
