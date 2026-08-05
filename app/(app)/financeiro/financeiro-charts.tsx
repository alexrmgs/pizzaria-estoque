"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MONTH_NAMES_SHORT, REVENUE_CHANNEL_LABELS } from "@/lib/financeiro";
import { CHANNEL_COLORS } from "@/components/channel-badge";

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
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FinanceiroCharts({
  monthlyTotals,
  stores,
  channelTotals,
  channelMonthly,
}: {
  monthlyTotals: { month: number; amount: number }[];
  stores: {
    storeId: string;
    storeName: string;
    totalAmount: number;
    months: { month: number; amount: number }[];
  }[];
  channelTotals?: { channel: string; amount: number; orders: number }[];
  channelMonthly?: Record<string, { month: number; amount: number; orders: number }[]>;
}) {
  const trendData = monthlyTotals.map((m) => ({
    month: MONTH_NAMES_SHORT[m.month],
    faturamento: m.amount,
  }));
  const trendConfig: ChartConfig = {
    faturamento: { label: "Faturamento", color: "var(--chart-1)" },
  };

  const storeData = stores.map((s, i) => ({
    storeName: s.storeName,
    faturamento: s.totalAmount,
    fill: STORE_COLORS[i % STORE_COLORS.length],
  }));
  const storeConfig: ChartConfig = Object.fromEntries(
    stores.map((s, i) => [
      s.storeName,
      { label: s.storeName, color: STORE_COLORS[i % STORE_COLORS.length] },
    ]),
  );

  const monthlyByStoreData = MONTH_NAMES_SHORT.map((label, month) => {
    const row: Record<string, string | number> = { month: label };
    for (const s of stores) {
      row[s.storeName] = s.months.find((m) => m.month === month)?.amount ?? 0;
    }
    return row;
  });

  const channelData = (channelTotals ?? [])
    .filter((c) => c.amount > 0)
    .map((c) => ({
      channel: REVENUE_CHANNEL_LABELS[c.channel] ?? c.channel,
      faturamento: c.amount,
      fill: CHANNEL_COLORS[c.channel] ?? "#9CA3AF",
    }));
  const channelConfig: ChartConfig = Object.fromEntries(
    (channelTotals ?? []).map((c) => [
      REVENUE_CHANNEL_LABELS[c.channel] ?? c.channel,
      { label: REVENUE_CHANNEL_LABELS[c.channel] ?? c.channel, color: CHANNEL_COLORS[c.channel] ?? "#9CA3AF" },
    ]),
  );

  const channelKeys = Object.keys(channelMonthly ?? {});
  const monthlyByChannelData = MONTH_NAMES_SHORT.map((label, month) => {
    const row: Record<string, string | number> = { month: label };
    for (const key of channelKeys) {
      row[REVENUE_CHANNEL_LABELS[key] ?? key] = channelMonthly?.[key]?.[month]?.amount ?? 0;
    }
    return row;
  });

  if (stores.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">📈 Faturamento mensal do grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => currency(v)}
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
          <CardTitle className="text-lg">📊 Faturamento mensal por loja</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={storeConfig} className="aspect-auto h-72 w-full">
            <LineChart data={monthlyByStoreData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => currency(v)}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {stores.map((s, i) => (
                <Line
                  key={s.storeId}
                  dataKey={s.storeName}
                  type="monotone"
                  stroke={STORE_COLORS[i % STORE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {channelKeys.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">📱 Faturamento mensal por canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={channelConfig} className="aspect-auto h-72 w-full">
              <LineChart data={monthlyByChannelData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tickFormatter={(v: number) => currency(v)}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                {channelKeys.map((key) => (
                  <Line
                    key={key}
                    dataKey={REVENUE_CHANNEL_LABELS[key] ?? key}
                    type="monotone"
                    stroke={CHANNEL_COLORS[key] ?? "#9CA3AF"}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💰 Faturamento por loja</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={storeConfig} className="aspect-auto h-72 w-full">
            <BarChart data={storeData} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => currency(v)} />
              <YAxis
                dataKey="storeName"
                type="category"
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />}
              />
              <Bar dataKey="faturamento" radius={4}>
                {storeData.map((entry) => (
                  <Cell key={entry.storeName} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🥧 Participação por loja</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={storeConfig} className="mx-auto aspect-square h-72">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {currency(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie data={storeData} dataKey="faturamento" nameKey="storeName" innerRadius={60} strokeWidth={4}>
                {storeData.map((entry) => (
                  <Cell key={entry.storeName} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="storeName" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {channelData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📱 Participação por canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={channelConfig} className="mx-auto aspect-square h-72">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">{String(name)}</span>
                          <span className="font-mono font-medium tabular-nums">
                            {currency(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie data={channelData} dataKey="faturamento" nameKey="channel" innerRadius={60} strokeWidth={4}>
                  {channelData.map((entry) => (
                    <Cell key={entry.channel} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="channel" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
