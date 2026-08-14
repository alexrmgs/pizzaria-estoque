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

/**
 * Preço sugerido pelo método da "margem de contribuição desejada": o custo
 * fixo fica de fora do preço (é coberto pelo volume vendido, não item a
 * item), mas o custo variável entra — senão a % que a loja pede não bate com
 * a margem de contribuição de verdade (que já é, por definição, o que sobra
 * depois de tirar o variável). Preço = custo / (1 - %variável - %margem).
 */
export function computeSuggestedPriceByMargin(
  unitCost: number,
  variablePercent: number,
  targetMarginPercent: number | null,
): number | null {
  if (targetMarginPercent === null) return null;
  const divisor = 1 - (variablePercent + targetMarginPercent) / 100;
  if (divisor <= 0) return null;
  return unitCost / divisor;
}
