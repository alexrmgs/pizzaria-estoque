import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FixedCostForm } from "./fixed-cost-form";
import { VariableCostForm } from "./variable-cost-form";
import { DeleteFixedCostButton } from "./delete-fixed-cost-button";
import { DeleteVariableCostButton } from "./delete-variable-cost-button";
import { FixedCostEditableCells } from "./fixed-cost-editable-cells";
import { VariableCostPercentageInput } from "./variable-cost-percentage-input";
import { RecipePriceInput } from "./recipe-price-input";
import { recipeItemCost, RECIPE_TYPE_LABELS } from "@/lib/recipe-cost";
import { computeSuggestedPrice, computeSuggestedPriceByMargin } from "@/lib/pricing";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { analisarPrecificacao } from "./ai-actions";
import { PricingMethodForm } from "./pricing-method-form";
import type { RecipeType } from "@/lib/generated/prisma/client";

const UNIT_YIELD_TYPES: RecipeType[] = ["PIZZA", "BEIRUTE", "ESFIHA"];

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function formatMonth(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function PrecificacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const currentUser = await requirePermission("canViewRelatorios");
  const params = await searchParams;

  const stores = await prisma.store.findMany({
    where: { companyId: currentUser.companyId },
    orderBy: { name: "asc" },
  });
  const storeIdParam = typeof params.storeId === "string" && params.storeId ? params.storeId : undefined;
  const selectedStoreId = storeIdParam ?? stores[0]?.id ?? "";
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null;
  const pricingMethod: "MARKUP" | "MARGEM" =
    selectedStore?.pricingMethod === "MARGEM" ? "MARGEM" : "MARKUP";
  const targetMarginPercent =
    selectedStore?.targetMarginPercent != null ? Number(selectedStore.targetMarginPercent) : null;
  const activeTab =
    params.tab === "custos-variaveis" || params.tab === "preco-final" ? params.tab : "custos-fixos";

  const [fixedCosts, variableCosts, recipes] = await Promise.all([
    selectedStoreId
      ? prisma.fixedCost.findMany({
          where: { storeId: selectedStoreId },
          orderBy: [{ referenceMonth: "desc" }, { category: "asc" }],
        })
      : Promise.resolve([]),
    selectedStoreId
      ? prisma.variableCostRate.findMany({
          where: { storeId: selectedStoreId },
          orderBy: { category: "asc" },
        })
      : Promise.resolve([]),
    prisma.recipe.findMany({
      where: { type: { in: UNIT_YIELD_TYPES } },
      include: { ingredients: { include: { ingredient: true } } },
      orderBy: [{ type: "asc" }, { order: "asc" }],
    }),
  ]);

  const totalVariablePercent = variableCosts.reduce((sum, c) => sum + Number(c.percentage), 0);

  // Custo fixo do mês mais recente cadastrado, virado % sobre a média de
  // faturamento dos últimos 12 meses FECHADOS (sem contar o mês atual, que
  // ainda não terminou e deixaria a base artificialmente baixa) — assim dá
  // pra embutir o custo fixo (que é em R$) no preço de cada receita junto
  // com os custos variáveis (que já são %).
  const latestFixedMonth = fixedCosts[0]?.referenceMonth ?? null;
  const latestMonthFixedTotal = latestFixedMonth
    ? fixedCosts
        .filter((c) => c.referenceMonth.getTime() === latestFixedMonth.getTime())
        .reduce((sum, c) => sum + Number(c.amount), 0)
    : 0;

  const today = new Date();
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const twelveMonthsAgoStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 1));
  const last12MonthsRevenues = await prisma.revenue.findMany({
    where: { storeId: selectedStoreId, date: { gte: twelveMonthsAgoStart, lt: currentMonthStart } },
    select: { date: true, amount: true },
  });
  const revenueByMonth = new Map<string, number>();
  for (const r of last12MonthsRevenues) {
    const key = `${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}`;
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(r.amount));
  }
  const monthsWithRevenue = revenueByMonth.size;
  const last12MonthsRevenueTotal = [...revenueByMonth.values()].reduce((sum, v) => sum + v, 0);
  const avgMonthlyRevenue = monthsWithRevenue > 0 ? last12MonthsRevenueTotal / monthsWithRevenue : 0;

  const fixedCostPercent =
    latestFixedMonth && avgMonthlyRevenue > 0 ? (latestMonthFixedTotal / avgMonthlyRevenue) * 100 : null;
  const totalMarkupPercent = fixedCostPercent !== null ? fixedCostPercent + totalVariablePercent : null;

  const priceRows = recipes.map((recipe) => {
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

    // As duas formas de precificar, sempre calculadas — a loja escolhe qual
    // vale como referência (pricingMethod), mas as duas ficam visíveis pra
    // comparar.
    const suggestedPriceMarkup =
      costPerUnit !== null ? computeSuggestedPrice(costPerUnit, totalMarkupPercent) : null;
    const suggestedPriceMargem =
      costPerUnit !== null
        ? computeSuggestedPriceByMargin(costPerUnit, targetMarginPercent)
        : null;
    const suggestedPrice = pricingMethod === "MARGEM" ? suggestedPriceMargem : suggestedPriceMarkup;

    const currentPrice = recipe.currentPrice !== null ? Number(recipe.currentPrice) : null;
    const adjustmentPercent =
      suggestedPrice !== null && currentPrice !== null && currentPrice > 0
        ? ((suggestedPrice - currentPrice) / currentPrice) * 100
        : null;

    // Margem de contribuição = preço − custo do produto. Não desconta nem o
    // custo fixo nem o variável — é o que sobra pra pagar os dois e ainda ter
    // lucro. Usa o preço praticado hoje; se ainda não cadastrou preço, usa o
    // sugerido como referência.
    const priceForMargin = currentPrice ?? suggestedPrice;
    const usaPrecoSugerido = currentPrice === null && suggestedPrice !== null;
    const contribMargin =
      priceForMargin !== null && costPerUnit !== null ? priceForMargin - costPerUnit : null;
    const contribMarginPercent =
      contribMargin !== null && priceForMargin! > 0 ? (contribMargin / priceForMargin!) * 100 : null;

    return {
      id: recipe.id,
      name: recipe.name,
      type: recipe.type,
      costPerUnit,
      suggestedPrice,
      currentPrice,
      adjustmentPercent,
      contribMargin,
      contribMarginPercent,
      usaPrecoSugerido,
    };
  });

  const priceRowsByType = {
    PIZZA: priceRows.filter((r) => r.type === "PIZZA"),
    ESFIHA: priceRows.filter((r) => r.type === "ESFIHA"),
    BEIRUTE: priceRows.filter((r) => r.type === "BEIRUTE"),
  };

  const validMargins = priceRows.filter((r) => r.contribMarginPercent !== null);
  const avgContribMarginPercent =
    validMargins.length > 0
      ? validMargins.reduce((s, r) => s + r.contribMarginPercent!, 0) / validMargins.length
      : null;
  // Referência pra saber se a margem média cobre fixo + variável (%) — a
  // margem agora não desconta nenhum dos dois, então precisa dar conta dos
  // dois pra sobrar lucro de verdade.
  const custosParaCobrir = (fixedCostPercent ?? 0) + totalVariablePercent;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Precificação</h1>
        <p className="text-sm text-neutral-500">
          Cadastre os custos fixos e variáveis de cada loja pra usar na precificação.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <input type="hidden" name="tab" value={activeTab} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="storeId">
            Loja
          </label>
          <select id="storeId" name="storeId" defaultValue={selectedStoreId} className={selectClassName}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Trocar loja
        </Button>
      </form>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="custos-fixos">Custos Fixos</TabsTrigger>
          <TabsTrigger value="custos-variaveis">Custos Variáveis</TabsTrigger>
          <TabsTrigger value="preco-final">Preço Final</TabsTrigger>
        </TabsList>

        <TabsContent value="custos-fixos" className="flex flex-col gap-6 pt-4">
          <FixedCostForm storeId={selectedStoreId} />

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedCosts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhum custo fixo cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {fixedCosts.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium capitalize">{formatMonth(cost.referenceMonth)}</TableCell>
                    <TableCell>{cost.category}</TableCell>
                    <FixedCostEditableCells
                      id={cost.id}
                      initialAmount={Number(cost.amount)}
                      initialNote={cost.note}
                    />
                    <TableCell className="text-right">
                      <DeleteFixedCostButton id={cost.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="custos-variaveis" className="flex flex-col gap-6 pt-4">
          <VariableCostForm storeId={selectedStoreId} />

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variableCosts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-neutral-500">
                      Nenhum custo variável cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {variableCosts.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium">{cost.category}</TableCell>
                    <TableCell>
                      <VariableCostPercentageInput id={cost.id} initialPercentage={Number(cost.percentage)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteVariableCostButton id={cost.id} />
                    </TableCell>
                  </TableRow>
                ))}
                {variableCosts.length > 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {totalVariablePercent.toLocaleString("pt-BR")}%
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="preco-final" className="flex flex-col gap-6 pt-4">
          <PricingMethodForm
            storeId={selectedStoreId}
            method={pricingMethod}
            targetMarginPercent={targetMarginPercent}
          />
          <AiAnalysisPanel
            action={analisarPrecificacao.bind(null, selectedStoreId)}
            title="Análise de preços com IA"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">📅 Mês de referência</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold capitalize">
                  {latestFixedMonth ? formatMonth(latestFixedMonth) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🏠 Custo fixo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {fixedCostPercent !== null
                    ? `${fixedCostPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : "—"}
                </p>
                <p className="text-xs text-neutral-500">
                  {latestMonthFixedTotal > 0 ? currency(latestMonthFixedTotal) : "—"} sobre a média de{" "}
                  {avgMonthlyRevenue > 0 ? currency(avgMonthlyRevenue) : "sem faturamento"}/mês (
                  {monthsWithRevenue} {monthsWithRevenue === 1 ? "mês fechado" : "meses fechados"})
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🧾 Custos variáveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{totalVariablePercent.toLocaleString("pt-BR")}%</p>
              </CardContent>
            </Card>
            {pricingMethod === "MARKUP" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-neutral-500">📊 Markup total</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-primary">
                    {totalMarkupPercent !== null
                      ? `${totalMarkupPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-neutral-500">custo fixo + variáveis embutidos no preço</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-neutral-500">🎯 Margem desejada</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-primary">
                    {targetMarginPercent !== null
                      ? `${targetMarginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    custo fixo e variável não entram no preço — só o custo do produto e a margem
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">💰 Margem de contribuição média</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={
                    "text-lg font-semibold " +
                    (avgContribMarginPercent !== null && avgContribMarginPercent < custosParaCobrir
                      ? "text-destructive"
                      : "text-emerald-600")
                  }
                >
                  {avgContribMarginPercent !== null
                    ? `${avgContribMarginPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : "—"}
                </p>
                <p className="text-xs text-neutral-500">
                  sobra depois do custo do produto, pra pagar o fixo, o variável e ainda lucrar
                </p>
              </CardContent>
            </Card>
          </div>

          {pricingMethod === "MARKUP" ? (
            <>
              {(fixedCostPercent === null || totalMarkupPercent === null) && (
                <p className="text-sm text-neutral-500">
                  Cadastre os custos fixos e garanta que a loja tenha faturamento lançado em algum mês
                  fechado (antes do mês atual) pra calcular o preço sugerido.
                </p>
              )}
              {totalMarkupPercent !== null && totalMarkupPercent >= 100 && (
                <p className="text-sm text-destructive">
                  A soma dos custos passou de 100% — não dá pra calcular um preço sugerido assim. Revise
                  os percentuais cadastrados.
                </p>
              )}
            </>
          ) : (
            <>
              {targetMarginPercent === null && (
                <p className="text-sm text-neutral-500">
                  Defina a margem de contribuição desejada no card acima pra calcular o preço sugerido.
                </p>
              )}
              {targetMarginPercent !== null && targetMarginPercent >= 100 && (
                <p className="text-sm text-destructive">
                  A margem desejada passou de 100% — não dá pra calcular um preço sugerido assim.
                </p>
              )}
            </>
          )}

          <Tabs defaultValue="PIZZA">
            <TabsList>
              <TabsTrigger value="PIZZA">Pizza ({priceRowsByType.PIZZA.length})</TabsTrigger>
              <TabsTrigger value="ESFIHA">Esfiha ({priceRowsByType.ESFIHA.length})</TabsTrigger>
              <TabsTrigger value="BEIRUTE">Beirute ({priceRowsByType.BEIRUTE.length})</TabsTrigger>
            </TabsList>
            {(["PIZZA", "ESFIHA", "BEIRUTE"] as const).map((type) => (
              <TabsContent key={type} value={type} className="pt-4">
                <div className="rounded-lg border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receita</TableHead>
                        <TableHead>Custo unitário</TableHead>
                        <TableHead>
                          Preço sugerido ({pricingMethod === "MARKUP" ? "markup" : "margem"})
                        </TableHead>
                        <TableHead>Seu preço hoje</TableHead>
                        <TableHead>Ajuste necessário</TableHead>
                        <TableHead>Margem de contribuição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceRowsByType[type].length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-neutral-500">
                            Nenhuma receita de {RECIPE_TYPE_LABELS[type].toLowerCase()} cadastrada.
                          </TableCell>
                        </TableRow>
                      )}
                      {priceRowsByType[type].map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            {row.costPerUnit !== null ? currency(row.costPerUnit) : "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {row.suggestedPrice !== null ? currency(row.suggestedPrice) : "—"}
                          </TableCell>
                          <TableCell>
                            <RecipePriceInput recipeId={row.id} initialPrice={row.currentPrice} />
                          </TableCell>
                          <TableCell>
                            {row.adjustmentPercent === null ? (
                              "—"
                            ) : row.adjustmentPercent > 1 ? (
                              <span className="text-destructive">
                                ▲ subir{" "}
                                {row.adjustmentPercent.toLocaleString("pt-BR", {
                                  maximumFractionDigits: 1,
                                })}
                                %
                              </span>
                            ) : (
                              <span className="text-emerald-600">✓ dentro da margem</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.contribMargin === null ? (
                              "—"
                            ) : (
                              <div>
                                <span
                                  className={
                                    "font-semibold " +
                                    (row.contribMargin >= 0 ? "text-emerald-600" : "text-destructive")
                                  }
                                >
                                  {currency(row.contribMargin)} (
                                  {row.contribMarginPercent!.toLocaleString("pt-BR", {
                                    maximumFractionDigits: 1,
                                  })}
                                  %)
                                </span>
                                {row.usaPrecoSugerido && (
                                  <p className="text-xs text-neutral-400">sobre o preço sugerido</p>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
