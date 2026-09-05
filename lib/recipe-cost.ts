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

const SMALLER_UNIT: Record<string, string> = { KG: "g", L: "ml" };

/**
 * Formata a quantidade de um item de receita pra exibição — quilos viram
 * gramas e litros viram mililitros (ex: 0.15 KG -> "150 g", 0.5 L ->
 * "500 ml"), porque fica mais fácil de visualizar na ficha impressa do que
 * uma fração de quilo/litro. Sempre arredonda pro número fechado (sem casas
 * decimais) — o valor exato continua guardado no banco, só a exibição muda.
 */
export function formatRecipeQuantity(quantity: number, unit: string): string {
  const smaller = SMALLER_UNIT[unit];
  if (smaller) {
    const converted = Math.round(quantity * 1000);
    return `${converted.toLocaleString("pt-BR")} ${smaller}`;
  }
  return `${Math.round(quantity).toLocaleString("pt-BR")} ${unit}`;
}

export const RECIPE_TYPE_LABELS: Record<string, string> = {
  PRODUCAO: "Produção",
  PIZZA: "Pizza",
  BEIRUTE: "Beirute",
  ESFIHA: "Esfiha",
};
