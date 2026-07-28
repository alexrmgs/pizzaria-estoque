/**
 * Ajusta a quantidade líquida (o que realmente entra no prato) pela % de
 * perda no preparo (limpeza, descarte, etc.), retornando quanto precisa
 * ser comprado/pesado bruto pra sobrar essa quantidade líquida.
 * Ex: 100g líquidos com 20% de perda -> precisa de 125g brutos.
 */
export function grossQuantity(netQuantity: number, wastePercent: number): number {
  const factor = 1 - wastePercent / 100;
  if (factor <= 0) return netQuantity;
  return netQuantity / factor;
}

export function recipeItemCost(
  netQuantity: number,
  wastePercent: number,
  unitPrice: number,
): number {
  return grossQuantity(netQuantity, wastePercent) * unitPrice;
}

export const RECIPE_TYPE_LABELS: Record<string, string> = {
  PRODUCAO: "Produção",
  PIZZA: "Pizza",
  BEIRUTE: "Beirute",
  ESFIHA: "Esfiha",
};
