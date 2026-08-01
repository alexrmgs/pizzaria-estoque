"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MONTH_NAMES_SHORT, type StoreYearAgg } from "@/lib/financeiro";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const chartCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const trendConfig: ChartConfig = {
  faturamento: { label: "Faturamento", color: "var(--chart-1)" },
};

export function StoreDashboard({ store, year }: { store: StoreYearAgg; year: number }) {
  const trendData = store.months.map((m) => ({
    month: MONTH_NAMES_SHORT[m.month],
    faturamento: m.amount,
  }));

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
