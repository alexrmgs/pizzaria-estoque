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

/**
 * Formata a quantidade de um item de receita pra exibição — quilos viram
 * gramas (ex: 0.15 KG -> "150 g"), porque fica mais fácil de visualizar na
 * ficha impressa do que uma fração de quilo. Outras unidades ficam como
 * estão.
 */
export function formatRecipeQuantity(quantity: number, unit: string): string {
  if (unit === "KG") {
    const grams = Math.round(quantity * 1000 * 10) / 10;
    return `${grams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`;
  }
  return `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit}`;
}

export const RECIPE_TYPE_LABELS: Record<string, string> = {
  PRODUCAO: "Produção",
  PIZZA: "Pizza",
  BEIRUTE: "Beirute",
  ESFIHA: "Esfiha",
};
