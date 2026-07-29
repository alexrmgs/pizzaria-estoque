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

/**
 * Preço por unidade usada na receita, quando o ingrediente é comprado numa
 * unidade maior (fardo, pacote com N caixas, pote de 1,7kg usado em
 * gramas...). `unitsPerPackage` é quantas unidades de receita cabem em 1
 * unidade de estoque — ex: 1 fardo = 50 caixas -> unitsPerPackage = 50; 1
 * unidade de molho = 1700g -> unitsPerPackage = 1700. Sem conversão
 * cadastrada, `unitsPerPackage` fica 1 e o preço não muda.
 */
export function recipeUnitPrice(unitPrice: number, unitsPerPackage: number): number {
  return unitsPerPackage > 0 ? unitPrice / unitsPerPackage : unitPrice;
}

export function recipeItemCost(
  netQuantity: number,
  wastePercent: number,
  unitPrice: number,
  unitsPerPackage: number = 1,
): number {
  return grossQuantity(netQuantity, wastePercent) * recipeUnitPrice(unitPrice, unitsPerPackage);
}

export const RECIPE_TYPE_LABELS: Record<string, string> = {
  PRODUCAO: "Produção",
  PIZZA: "Pizza",
  BEIRUTE: "Beirute",
  ESFIHA: "Esfiha",
};
