"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { recipeItemCost, RECIPE_TYPE_LABELS } from "@/lib/recipe-cost";
import { computeSuggestedPrice } from "@/lib/pricing";
import { generateBusinessAnalysis } from "@/lib/ai-analysis";
import type { RecipeType } from "@/lib/generated/prisma/client";

const UNIT_YIELD_TYPES: RecipeType[] = ["PIZZA", "BEIRUTE", "ESFIHA"];
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function analisarPrecificacao(storeId: string): Promise<{ text?: string; error?: string }> {
  const user = await requirePermission("canViewRelatorios");

  try {
    const store = await prisma.store.findFirst({
      where: { id: storeId, companyId: user.companyId },
      select: { name: true },
    });
    if (!store) return { error: "Loja não encontrada." };

    const [fixedCosts, variableCosts, recipes] = await Promise.all([
      prisma.fixedCost.findMany({
        where: { storeId },
        orderBy: [{ referenceMonth: "desc" }, { category: "asc" }],
      }),
      prisma.variableCostRate.findMany({ where: { storeId }, orderBy: { category: "asc" } }),
      prisma.recipe.findMany({
        where: { type: { in: UNIT_YIELD_TYPES } },
        include: { ingredients: { include: { ingredient: true } } },
        orderBy: [{ type: "asc" }, { order: "asc" }],
      }),
    ]);

    const totalVariablePercent = variableCosts.reduce((sum, c) => sum + Number(c.percentage), 0);

    const latestFixedMonth = fixedCosts[0]?.referenceMonth ?? null;
    const latestMonthFixedTotal = latestFixedMonth
      ? fixedCosts
          .filter((c) => c.referenceMonth.getTime() === latestFixedMonth.getTime())
          .reduce((sum, c) => sum + Number(c.amount), 0)
      : 0;

    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const twelveMonthsAgoStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const last12 = await prisma.revenue.findMany({
      where: { storeId, date: { gte: twelveMonthsAgoStart, lt: currentMonthStart } },
      select: { date: true, amount: true },
    });
    const revenueByMonth = new Map<string, number>();
    for (const r of last12) {
      const key = `${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}`;
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(r.amount));
    }
    const monthsWithRevenue = revenueByMonth.size;
    const avgMonthlyRevenue =
      monthsWithRevenue > 0
        ? [...revenueByMonth.values()].reduce((a, b) => a + b, 0) / monthsWithRevenue
        : 0;

    const fixedCostPercent =
      latestFixedMonth && avgMonthlyRevenue > 0 ? (latestMonthFixedTotal / avgMonthlyRevenue) * 100 : null;
    const totalMarkupPercent = fixedCostPercent !== null ? fixedCostPercent + totalVariablePercent : null;

    const lines: string[] = [];
    lines.push(`Loja: ${store.name}.`);
    lines.push(
      `Custo fixo estimado: ${
        fixedCostPercent !== null ? `${fixedCostPercent.toFixed(1)}%` : "sem base de faturamento"
      } (custo fixo do mês ${brl(latestMonthFixedTotal)} sobre média de ${brl(avgMonthlyRevenue)}/mês).`,
    );
    lines.push(
      `Custos variáveis cadastrados: ${
        variableCosts.length
          ? variableCosts.map((c) => `${c.category} ${Number(c.percentage)}%`).join(", ")
          : "nenhum"
      } (total ${totalVariablePercent}%).`,
    );
    lines.push(
      `Markup total: ${totalMarkupPercent !== null ? `${totalMarkupPercent.toFixed(1)}%` : "não calculável"}.`,
    );

    lines.push("\nReceitas (custo unitário → preço sugerido → seu preço hoje → ajuste):");
    for (const recipe of recipes) {
      const totalCost = recipe.ingredients.reduce(
        (sum, item) =>
          sum +
          recipeItemCost(
            Number(item.quantity),
            Number(item.wastePercent),
            Number(item.ingredient.unitPrice),
            Number(item.ingredient.unitsPerPackage),
          ),
        0,
      );
      const costPerUnit = recipe.yieldUnits && recipe.yieldUnits > 0 ? totalCost / recipe.yieldUnits : null;
      if (costPerUnit === null) continue;
      const suggested = computeSuggestedPrice(costPerUnit, totalMarkupPercent);
      const current = recipe.currentPrice !== null ? Number(recipe.currentPrice) : null;
      const adjustment =
        suggested !== null && current !== null && current > 0
          ? ((suggested - current) / current) * 100
          : null;
      lines.push(
        `- [${RECIPE_TYPE_LABELS[recipe.type]}] ${recipe.name}: custo ${brl(costPerUnit)} → sugerido ${
          suggested !== null ? brl(suggested) : "—"
        } → hoje ${current !== null ? brl(current) : "não cadastrado"}${
          adjustment !== null
            ? ` → ${adjustment > 0 ? `subir ${adjustment.toFixed(1)}%` : "dentro da margem"}`
            : ""
        }`,
      );
    }

    const text = await generateBusinessAnalysis(
      `Análise de precificação dos produtos da loja ${store.name}.`,
      lines.join("\n"),
    );
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
