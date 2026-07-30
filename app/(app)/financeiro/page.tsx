import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RevenueDialog } from "../dashboard/revenue-dialog";
import { DeleteRevenueButton } from "./delete-revenue-button";
import { FinanceiroCharts } from "./financeiro-charts";
import { buildYearlySummary, MONTH_NAMES_SHORT } from "@/lib/financeiro";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const MEDALS = ["🥇", "🥈", "🥉"];

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canViewRelatorios");

  const params = await searchParams;
  const activeTab = params.tab === "lancamentos" ? "lancamentos" : "dashboard";

  const currentYear = new Date().getFullYear();
  const year = typeof params.year === "string" ? parseInt(params.year, 10) || currentYear : currentYear;

  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : startOfCurrentMonth();
  const to = toParam ? new Date(`${toParam}T23:59:59`) : new Date();
  const fromISO = toISODate(from);
  const toISO = toISODate(to);

  const [stores, periodRevenues, yearRevenues] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.revenue.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      include: { store: { select: { name: true } } },
    }),
    prisma.revenue.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T23:59:59Z`) },
      },
      include: { store: { select: { name: true } } },
    }),
  ]);

  // --- Lançamentos (período) ---
  type StoreAgg = { storeId: string; name: string; amount: number; orders: number };
  const byStore = new Map<string, StoreAgg>();
  for (const store of stores) {
    byStore.set(store.id, { storeId: store.id, name: store.name, amount: 0, orders: 0 });
  }
  let totalAmount = 0;
  let totalOrders = 0;
  for (const r of periodRevenues) {
    const agg = byStore.get(r.storeId) ?? { storeId: r.storeId, name: r.store.name, amount: 0, orders: 0 };
    agg.amount += Number(r.amount);
    agg.orders += r.orderCount;
    byStore.set(r.storeId, agg);
    totalAmount += Number(r.amount);
    totalOrders += r.orderCount;
  }
  const storeAggs = [...byStore.values()].sort((a, b) => b.amount - a.amount);
  const overallTicket = totalOrders > 0 ? totalAmount / totalOrders : null;

  // --- Dashboard (ano) ---
  const summary = buildYearlySummary(
    yearRevenues.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      storeId: r.storeId,
      storeName: r.store.name,
      amount: Number(r.amount),
      orderCount: r.orderCount,
    })),
    stores.map((s) => ({ id: s.id, name: s.name })),
  );
  const storesByAmount = [...summary.stores].sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-neutral-500">
            Faturamento, pedidos e ticket médio de cada loja.
          </p>
        </div>
        <RevenueDialog stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex flex-col gap-6 pt-4">
          <div className="flex items-center justify-between rounded-lg border bg-white p-3">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/financeiro?tab=dashboard&year=${year - 1}`} />}
            >
              ← {year - 1}
            </Button>
            <p className="text-sm font-medium">Ano de {year}</p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/financeiro?tab=dashboard&year=${year + 1}`} />}
            >
              {year + 1} →
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">💰 Faturamento total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{currency(summary.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">📦 Total de pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{summary.totalOrders.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🎫 Ticket médio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{currency(summary.overallTicket)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🏆 Melhor faturamento</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.bestRevenueStore ? (
                  <>
                    <p className="text-xl font-semibold">{summary.bestRevenueStore.storeName}</p>
                    <p className="text-sm text-primary">{currency(summary.bestRevenueStore.totalAmount)}</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Sem dados em {year}.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🎫 Melhor ticket médio</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.bestTicketStore ? (
                  <>
                    <p className="text-xl font-semibold">{summary.bestTicketStore.storeName}</p>
                    <p className="text-sm text-primary">{currency(summary.bestTicketStore.avgTicket)}</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Sem dados em {year}.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <FinanceiroCharts
            monthlyTotals={summary.monthlyTotals}
            stores={storesByAmount.map((s) => ({
              storeId: s.storeId,
              storeName: s.storeName,
              totalAmount: s.totalAmount,
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                🏅 Ranking — score composto (40% faturamento + 30% pedidos + 30% ticket médio)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.ranking.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-neutral-500">
                          Sem dados em {year}.
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.ranking.map((s, i) => (
                      <TableRow key={s.storeId}>
                        <TableCell>{MEDALS[i] ?? `${i + 1}º`}</TableCell>
                        <TableCell className="font-medium">{s.storeName}</TableCell>
                        <TableCell>{currency(s.totalAmount)}</TableCell>
                        <TableCell className="text-neutral-500">{s.totalOrders.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-neutral-500">{currency(s.avgTicket)}</TableCell>
                        <TableCell className="font-medium text-primary">
                          {s.finalScore.toFixed(1)}/10
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {summary.ranking.length > 0 && (
                <p className="mt-3 text-sm text-neutral-500">
                  ⭐ A melhor loja de {year} é <span className="font-medium text-foreground">{summary.ranking[0].storeName}</span> —{" "}
                  {currency(summary.ranking[0].totalAmount)}, {summary.ranking[0].totalOrders.toLocaleString("pt-BR")}{" "}
                  pedidos, ticket médio {currency(summary.ranking[0].avgTicket)}, score{" "}
                  {summary.ranking[0].finalScore.toFixed(1)}/10.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💰 Faturamento mensal por loja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {storesByAmount.map((s) => (
                        <TableHead key={s.storeId}>{s.storeName}</TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {storesByAmount.map((s) => (
                          <TableCell key={s.storeId} className="text-neutral-500">
                            {currency(s.months[month].amount)}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium">
                          {currency(summary.monthlyTotals[month].amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {storesByAmount.map((s) => (
                        <TableCell key={s.storeId} className="font-semibold">
                          {currency(s.totalAmount)}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-primary">
                        {currency(summary.totalAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs text-neutral-500">% participação</TableCell>
                      {storesByAmount.map((s) => (
                        <TableCell key={s.storeId} className="text-xs text-neutral-500">
                          {summary.totalAmount > 0 ? percent(s.totalAmount / summary.totalAmount) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-neutral-500">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🏆 Melhor loja de cada mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Melhor loja</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>% do total</TableHead>
                      <TableHead>Melhor ticket médio</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.monthBests.map((mb, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{MONTH_NAMES_SHORT[month]}</TableCell>
                        <TableCell>{mb.bestRevenueStore ?? "—"}</TableCell>
                        <TableCell className="text-neutral-500">
                          {mb.bestRevenueStore ? currency(mb.bestRevenueAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-neutral-500">
                          {mb.bestRevenueShare !== null ? percent(mb.bestRevenueShare) : "—"}
                        </TableCell>
                        <TableCell>{mb.bestTicketStore ?? "—"}</TableCell>
                        <TableCell className="text-neutral-500">
                          {mb.bestTicketAmount !== null ? currency(mb.bestTicketAmount) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📦 Quantidade de pedidos por loja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {storesByAmount.map((s) => (
                        <TableHead key={s.storeId}>{s.storeName}</TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {storesByAmount.map((s) => (
                          <TableCell key={s.storeId} className="text-neutral-500">
                            {s.months[month].orders.toLocaleString("pt-BR")}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium">
                          {summary.monthlyTotals[month].orders.toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {storesByAmount.map((s) => (
                        <TableCell key={s.storeId} className="font-semibold">
                          {s.totalOrders.toLocaleString("pt-BR")}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-primary">
                        {summary.totalOrders.toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🎫 Ticket médio por loja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {storesByAmount.map((s) => (
                        <TableHead key={s.storeId}>{s.storeName}</TableHead>
                      ))}
                      <TableHead>Média</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {storesByAmount.map((s) => {
                          const m = s.months[month];
                          const ticket = m.orders > 0 ? m.amount / m.orders : null;
                          return (
                            <TableCell key={s.storeId} className="text-neutral-500">
                              {ticket !== null ? currency(ticket) : "—"}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-medium">
                          {summary.monthlyTotals[month].orders > 0
                            ? currency(summary.monthlyTotals[month].amount / summary.monthlyTotals[month].orders)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Média geral</TableCell>
                      {storesByAmount.map((s) => (
                        <TableCell key={s.storeId} className="font-semibold">
                          {s.avgTicket > 0 ? currency(s.avgTicket) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-primary">
                        {currency(summary.overallTicket)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lancamentos" className="flex flex-col gap-6 pt-4">
          <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
            <input type="hidden" name="tab" value="lancamentos" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="from">
                De
              </label>
              <input id="from" name="from" type="date" defaultValue={fromISO} className={selectClassName} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="to">
                Até
              </label>
              <input id="to" name="to" type="date" defaultValue={toISO} className={selectClassName} />
            </div>
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href="/financeiro?tab=lancamentos" />}
            >
              Mês atual
            </Button>
          </form>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Por loja no período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeAggs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-neutral-500">
                          Nenhuma loja cadastrada ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {storeAggs.map((agg) => {
                      const ticket = agg.orders > 0 ? agg.amount / agg.orders : null;
                      return (
                        <TableRow key={agg.storeId}>
                          <TableCell className="font-medium">{agg.name}</TableCell>
                          <TableCell>{currency(agg.amount)}</TableCell>
                          <TableCell className="text-neutral-500">{agg.orders}</TableCell>
                          <TableCell className="text-neutral-500">
                            {ticket !== null ? currency(ticket) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {storeAggs.length > 0 && (
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="font-semibold">{currency(totalAmount)}</TableCell>
                        <TableCell className="font-semibold">{totalOrders}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {overallTicket !== null ? currency(overallTicket) : "—"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lançamentos do período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodRevenues.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-neutral-500">
                          Nenhum faturamento lançado nesse período.
                        </TableCell>
                      </TableRow>
                    )}
                    {periodRevenues.map((r) => {
                      const amount = Number(r.amount);
                      const ticket = r.orderCount > 0 ? amount / r.orderCount : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.date.toISOString().slice(0, 10).split("-").reverse().join("/")}
                          </TableCell>
                          <TableCell className="font-medium">{r.store.name}</TableCell>
                          <TableCell>{currency(amount)}</TableCell>
                          <TableCell className="text-neutral-500">{r.orderCount || "—"}</TableCell>
                          <TableCell className="text-neutral-500">
                            {ticket !== null ? currency(ticket) : "—"}
                          </TableCell>
                          <TableCell className="text-neutral-500">{r.note ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <RevenueDialog
                                stores={stores.map((s) => ({ id: s.id, name: s.name }))}
                                revenue={{
                                  id: r.id,
                                  date: r.date.toISOString().slice(0, 10),
                                  storeId: r.storeId,
                                  amount: Number(r.amount),
                                  orderCount: r.orderCount,
                                  note: r.note,
                                }}
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    Editar
                                  </Button>
                                }
                              />
                              <DeleteRevenueButton id={r.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
