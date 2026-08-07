"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const STORE_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#ec4899",
];

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const chartCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const trendConfig: ChartConfig = {
  faturamento: { label: "Faturamento", color: "var(--chart-1)" },
};

export function HistoricoCharts({
  yearlyTotals,
  storeYearly,
}: {
  yearlyTotals: { year: number; amount: number }[];
  storeYearly: { storeId: string; storeName: string; years: { year: number; amount: number }[] }[];
}) {
  const trendData = yearlyTotals.map((y) => ({ year: String(y.year), faturamento: y.amount }));

  const byStoreData = yearlyTotals.map((y) => {
    const row: Record<string, string | number> = { year: String(y.year) };
    for (const s of storeYearly) {
      row[s.storeName] = s.years.find((yy) => yy.year === y.year)?.amount ?? 0;
    }
    return row;
  });
  const storeConfig: ChartConfig = Object.fromEntries(
    storeYearly.map((s, i) => [s.storeName, { label: s.storeName, color: STORE_COLORS[i % STORE_COLORS.length] }]),
  );

  if (yearlyTotals.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">📈 Faturamento anual — rede toda</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => chartCurrency(v)}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />} />
              <Area
                dataKey="faturamento"
                type="monotone"
                fill="var(--color-faturamento)"
                fillOpacity={0.2}
                stroke="var(--color-faturamento)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">📊 Faturamento anual por loja</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={storeConfig} className="aspect-auto h-72 w-full">
            <LineChart data={byStoreData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => chartCurrency(v)}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {storeYearly.map((s, i) => (
                <Line
                  key={s.storeId}
                  dataKey={s.storeName}
                  type="monotone"
                  stroke={STORE_COLORS[i % STORE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
