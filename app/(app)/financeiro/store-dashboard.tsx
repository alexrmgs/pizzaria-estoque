"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MONTH_NAMES_SHORT, REVENUE_CHANNELS, type StoreYearAgg } from "@/lib/financeiro";
import { ChannelBadge } from "@/components/channel-badge";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const chartCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const trendConfig: ChartConfig = {
  faturamento: { label: "Faturamento", color: "var(--chart-1)" },
};

const dailyConfig: ChartConfig = {
  faturamento: { label: "Faturamento", color: "var(--chart-1)" },
  ticket: { label: "Ticket médio", color: "var(--chart-2)" },
};

const WEEKDAY_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type DailyRecord = { date: string; amount: number; orders: number; channel: string };

function computeChannelBreakdown(dailyRecords: DailyRecord[]) {
  const totals = new Map<string, { amount: number; orders: number }>();
  for (const c of REVENUE_CHANNELS) totals.set(c, { amount: 0, orders: 0 });
  let totalAmount = 0;
  for (const r of dailyRecords) {
    const agg = totals.get(r.channel) ?? { amount: 0, orders: 0 };
    agg.amount += r.amount;
    agg.orders += r.orders;
    totals.set(r.channel, agg);
    totalAmount += r.amount;
  }
  return [...totals.entries()]
    .map(([channel, agg]) => ({
      channel,
      amount: agg.amount,
      orders: agg.orders,
      share: totalAmount > 0 ? agg.amount / totalAmount : null,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Consolida os lançamentos (agora um por canal) em um total por dia — os
 * gráficos e destaques abaixo trabalham com o faturamento do dia inteiro,
 * não por canal. */
function aggregateByDate(dailyRecords: DailyRecord[]): { date: string; amount: number; orders: number }[] {
  const byDate = new Map<string, { date: string; amount: number; orders: number }>();
  for (const r of dailyRecords) {
    const agg = byDate.get(r.date) ?? { date: r.date, amount: 0, orders: 0 };
    agg.amount += r.amount;
    agg.orders += r.orders;
    byDate.set(r.date, agg);
  }
  return [...byDate.values()];
}

function buildDailyData(dailyRecords: DailyRecord[], year: number, month: number) {
  const byDate = new Map(aggregateByDate(dailyRecords).map((r) => [r.date, r]));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = byDate.get(iso);
    const amount = rec?.amount ?? 0;
    const orders = rec?.orders ?? 0;
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    return {
      day,
      weekday: WEEKDAY_ABBR[weekday],
      faturamento: amount,
      ticket: orders > 0 ? amount / orders : null,
    };
  });
}

function formatDayLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function maxBy<T>(list: T[], fn: (item: T) => number): T | null {
  return list.reduce<T | null>((best, item) => (best === null || fn(item) > fn(best) ? item : best), null);
}

function minBy<T>(list: T[], fn: (item: T) => number): T | null {
  return list.reduce<T | null>((worst, item) => (worst === null || fn(item) < fn(worst) ? item : worst), null);
}

type AggregatedDay = { date: string; amount: number; orders: number };
type DayHighlight = { date: string; amount: number } | null;
type TicketHighlight = { date: string; ticket: number } | null;

function computeHighlights(dailyRecords: DailyRecord[], year: number, month: number) {
  const aggregated = aggregateByDate(dailyRecords);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthRecords = aggregated.filter((r) => r.date.startsWith(monthPrefix) && r.amount > 0);
  const yearRecords = aggregated.filter((r) => r.amount > 0);

  const bestDayMonthRec = maxBy(monthRecords, (r) => r.amount);
  const bestDayYearRec = maxBy(yearRecords, (r) => r.amount);
  const worstDayMonthRec = minBy(monthRecords, (r) => r.amount);

  const monthWithOrders = monthRecords.filter((r) => r.orders > 0);
  const yearWithOrders = yearRecords.filter((r) => r.orders > 0);
  const bestTicketMonthRec = maxBy(monthWithOrders, (r) => r.amount / r.orders);
  const bestTicketYearRec = maxBy(yearWithOrders, (r) => r.amount / r.orders);

  const sumByWeekday = new Array(7).fill(0) as number[];
  const countByWeekday = new Array(7).fill(0) as number[];
  for (const r of yearRecords) {
    const weekday = new Date(`${r.date}T00:00:00Z`).getUTCDay();
    sumByWeekday[weekday] += r.amount;
    countByWeekday[weekday] += 1;
  }
  let bestWeekday: { weekday: string; avg: number } | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (countByWeekday[weekday] === 0) continue;
    const avg = sumByWeekday[weekday] / countByWeekday[weekday];
    if (!bestWeekday || avg > bestWeekday.avg) {
      bestWeekday = { weekday: WEEKDAY_ABBR[weekday], avg };
    }
  }

  const toDayHighlight = (r: AggregatedDay | null): DayHighlight =>
    r ? { date: r.date, amount: r.amount } : null;
  const toTicketHighlight = (r: AggregatedDay | null): TicketHighlight =>
    r ? { date: r.date, ticket: r.amount / r.orders } : null;

  return {
    bestDayMonth: toDayHighlight(bestDayMonthRec),
    bestDayYear: toDayHighlight(bestDayYearRec),
    worstDayMonth: toDayHighlight(worstDayMonthRec),
    bestTicketMonth: toTicketHighlight(bestTicketMonthRec),
    bestTicketYear: toTicketHighlight(bestTicketYearRec),
    bestWeekday,
  };
}

function DayAxisTick({
  x,
  y,
  payload,
  weekdayByDay,
}: {
  x?: string | number;
  y?: string | number;
  payload?: { value: number };
  weekdayByDay: Map<number, string>;
}) {
  const day = payload?.value ?? 0;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
        {day}
      </text>
      <text x={0} y={0} dy={25} textAnchor="middle" fontSize={9} className="fill-muted-foreground">
        {weekdayByDay.get(day) ?? ""}
      </text>
    </g>
  );
}

export function StoreDashboard({
  store,
  year,
  dailyRecords,
}: {
  store: StoreYearAgg;
  year: number;
  dailyRecords: DailyRecord[];
}) {
  const trendData = store.months.map((m) => ({
    month: MONTH_NAMES_SHORT[m.month],
    faturamento: m.amount,
  }));

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    if (now.getFullYear() === year) return now.getMonth();
    for (let m = 11; m >= 0; m--) {
      if (dailyRecords.some((r) => Number(r.date.slice(5, 7)) - 1 === m)) return m;
    }
    return 0;
  });

  const dailyData = useMemo(
    () => buildDailyData(dailyRecords, year, selectedMonth),
    [dailyRecords, year, selectedMonth],
  );
  const weekdayByDay = useMemo(
    () => new Map(dailyData.map((d) => [d.day, d.weekday])),
    [dailyData],
  );
  const highlights = useMemo(
    () => computeHighlights(dailyRecords, year, selectedMonth),
    [dailyRecords, year, selectedMonth],
  );
  const channelBreakdown = useMemo(() => computeChannelBreakdown(dailyRecords), [dailyRecords]);
  const selectedMonthAgg = store.months[selectedMonth];
  const selectedMonthTicket =
    selectedMonthAgg.orders > 0 ? selectedMonthAgg.amount / selectedMonthAgg.orders : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">💰 Faturamento em {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(store.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">📦 Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{store.totalOrders.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">🎫 Ticket médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(store.avgTicket)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🛵 Faturamento por canal — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Ticket médio</TableHead>
                  <TableHead>% do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelBreakdown.every((c) => c.amount === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Sem dados em {year}.
                    </TableCell>
                  </TableRow>
                )}
                {channelBreakdown.map((c) => {
                  const ticket = c.orders > 0 ? c.amount / c.orders : null;
                  return (
                    <TableRow key={c.channel}>
                      <TableCell className="font-medium">
                        <ChannelBadge channel={c.channel} />
                      </TableCell>
                      <TableCell>{c.amount > 0 ? currency(c.amount) : "—"}</TableCell>
                      <TableCell className="text-neutral-500">
                        {c.orders > 0 ? c.orders.toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {ticket !== null ? currency(ticket) : "—"}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {c.share !== null ? `${(c.share * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌟 Destaques — {store.storeName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">🏆 Melhor dia — {MONTH_NAMES_SHORT[selectedMonth]}</p>
              {highlights.bestDayMonth ? (
                <>
                  <p className="text-lg font-semibold">{currency(highlights.bestDayMonth.amount)}</p>
                  <p className="text-xs text-neutral-500">{formatDayLabel(highlights.bestDayMonth.date)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">🏆 Melhor dia — {year}</p>
              {highlights.bestDayYear ? (
                <>
                  <p className="text-lg font-semibold">{currency(highlights.bestDayYear.amount)}</p>
                  <p className="text-xs text-neutral-500">{formatDayLabel(highlights.bestDayYear.date)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">📉 Pior dia — {MONTH_NAMES_SHORT[selectedMonth]}</p>
              {highlights.worstDayMonth ? (
                <>
                  <p className="text-lg font-semibold">{currency(highlights.worstDayMonth.amount)}</p>
                  <p className="text-xs text-neutral-500">{formatDayLabel(highlights.worstDayMonth.date)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">
                🎫 Melhor ticket — {MONTH_NAMES_SHORT[selectedMonth]}
              </p>
              {highlights.bestTicketMonth ? (
                <>
                  <p className="text-lg font-semibold text-primary">
                    {currency(highlights.bestTicketMonth.ticket)}
                  </p>
                  <p className="text-xs text-neutral-500">{formatDayLabel(highlights.bestTicketMonth.date)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">🎫 Melhor ticket — {year}</p>
              {highlights.bestTicketYear ? (
                <>
                  <p className="text-lg font-semibold text-primary">
                    {currency(highlights.bestTicketYear.ticket)}
                  </p>
                  <p className="text-xs text-neutral-500">{formatDayLabel(highlights.bestTicketYear.date)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">📊 Melhor dia da semana — {year}</p>
              {highlights.bestWeekday ? (
                <>
                  <p className="text-lg font-semibold">{highlights.bestWeekday.weekday}</p>
                  <p className="text-xs text-neutral-500">média {currency(highlights.bestWeekday.avg)}</p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Sem dados.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📈 Faturamento mensal — {store.storeName}</CardTitle>
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
                tickFormatter={(v: number) => chartCurrency(v)}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />}
              />
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">📅 Vendas e ticket médio diário — {store.storeName}</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">
              {selectedMonthAgg.amount > 0
                ? `${currency(selectedMonthAgg.amount)} · ${selectedMonthAgg.orders.toLocaleString("pt-BR")} pedidos · ticket médio ${selectedMonthTicket !== null ? currency(selectedMonthTicket) : "—"}`
                : "Nenhum lançamento nesse mês."}
            </p>
          </div>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => v && setSelectedMonth(Number(v))}
            items={MONTH_NAMES_SHORT.map((label, month) => ({ value: String(month), label }))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES_SHORT.map((label, month) => (
                <SelectItem key={month} value={String(month)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={dailyConfig} className="aspect-auto h-64 w-full">
            <ComposedChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                height={40}
                interval={0}
                tick={(props) => <DayAxisTick {...props} weekdayByDay={weekdayByDay} />}
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => chartCurrency(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={80}
                tickFormatter={(v: number) => chartCurrency(v)}
              />
              <ChartTooltip
                labelFormatter={(label) => `Dia ${label} (${weekdayByDay.get(Number(label)) ?? ""})`}
                content={<ChartTooltipContent formatter={(value) => currency(Number(value))} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="left" dataKey="faturamento" fill="var(--color-faturamento)" radius={4} />
              <Line
                yAxisId="right"
                dataKey="ticket"
                type="monotone"
                stroke="var(--color-ticket)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.months.map((m) => {
                  const ticket = m.orders > 0 ? m.amount / m.orders : null;
                  return (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{MONTH_NAMES_SHORT[m.month]}</TableCell>
                      <TableCell>{m.amount > 0 ? currency(m.amount) : "—"}</TableCell>
                      <TableCell className="text-neutral-500">
                        {m.orders > 0 ? m.orders.toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {ticket !== null ? currency(ticket) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="font-semibold">{currency(store.totalAmount)}</TableCell>
                  <TableCell className="font-semibold">
                    {store.totalOrders.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {currency(store.avgTicket)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
