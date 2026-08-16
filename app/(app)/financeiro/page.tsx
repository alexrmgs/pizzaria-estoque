import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import { DailyRevenueDialog } from "../dashboard/daily-revenue-dialog";
import { DeleteRevenueButton } from "./delete-revenue-button";
import { FinanceiroCharts } from "./financeiro-charts";
import { HistoricoCharts } from "./historico-charts";
import { StoreDashboard } from "./store-dashboard";
import { SaiposSync } from "./saipos-sync";
import { ChannelBadge } from "@/components/channel-badge";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { analisarFinanceiro } from "./ai-actions";
import {
  buildYearlySummary,
  computeRevenueProjection,
  MONTH_NAMES_SHORT,
  REVENUE_CHANNELS,
} from "@/lib/financeiro";

// A API da SaiPos é lenta (~28s por página de 1000 vendas). Dá mais fôlego pro
// server action de importação não estourar o tempo limite.
export const maxDuration = 300;
// Nunca serve versão em cache dessa página — depois de "Puxar SaiPos" os
// números têm que refletir o banco na hora, sem depender de revalidação.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const MEDALS = ["🥇", "🥈", "🥉"];

/** Selo de variação vs. o ano anterior — dá noção rápida de tendência nos
 * cards do dashboard sem precisar abrir os gráficos mensais. */
function TrendBadge({ value, suffix = " vs ano anterior" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const isUp = value >= 0;
  return (
    <span className={cn("text-xs font-medium", isUp ? "text-emerald-600" : "text-destructive")}>
      {isUp ? "▲" : "▼"} {percent(Math.abs(value))}
      {suffix}
    </span>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-base font-semibold uppercase">{title}</h2>
      {description && <p className="text-sm text-neutral-500">{description}</p>}
    </div>
  );
}

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
  const currentUser = await requirePermission("canViewRelatorios");

  const params = await searchParams;
  const tabParam = typeof params.tab === "string" ? params.tab : undefined;
  const activeTab =
    tabParam === "lancamentos" || tabParam === "historico" || tabParam?.startsWith("store-")
      ? tabParam
      : "dashboard";

  const currentYear = new Date().getFullYear();
  const year = typeof params.year === "string" ? parseInt(params.year, 10) || currentYear : currentYear;

  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : startOfCurrentMonth();
  const to = toParam ? new Date(`${toParam}T23:59:59`) : new Date();
  const fromISO = toISODate(from);
  const toISO = toISODate(to);
  const storeIdParam = typeof params.storeId === "string" && params.storeId ? params.storeId : undefined;

  const [stores, periodRevenues, yearRevenues, prevYearAgg, allRevenues] = await Promise.all([
    prisma.store.findMany({ where: { companyId: currentUser.companyId }, orderBy: { name: "asc" } }),
    prisma.revenue.findMany({
      where: {
        date: { gte: from, lte: to },
        store: { companyId: currentUser.companyId },
        ...(storeIdParam ? { storeId: storeIdParam } : {}),
      },
      orderBy: { date: "desc" },
      include: { store: { select: { name: true } } },
    }),
    prisma.revenue.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T23:59:59Z`) },
        store: { companyId: currentUser.companyId },
      },
      include: { store: { select: { name: true } } },
    }),
    // Totais do ano anterior — só pra comparar crescimento no dashboard, não
    // precisa dos registros completos.
    prisma.revenue.aggregate({
      where: {
        date: {
          gte: new Date(`${year - 1}-01-01T00:00:00Z`),
          lte: new Date(`${year - 1}-12-31T23:59:59Z`),
        },
        store: { companyId: currentUser.companyId },
      },
      _sum: { amount: true, orderCount: true },
    }),
    // Todo o histórico (todos os anos) — pra evolução anual e ranking geral
    // da rede, sem ficar preso ao ano selecionado no dashboard.
    prisma.revenue.findMany({
      where: { store: { companyId: currentUser.companyId } },
      select: { date: true, storeId: true, amount: true, orderCount: true },
    }),
  ]);

  // --- Lançamentos (período) ---
  type StoreAgg = { storeId: string; name: string; amount: number; orders: number };
  const byStore = new Map<string, StoreAgg>();
  for (const store of stores) {
    byStore.set(store.id, { storeId: store.id, name: store.name, amount: 0, orders: 0 });
  }
  type ChannelAgg = { channel: string; amount: number; orders: number };
  const byChannel = new Map<string, ChannelAgg>();
  for (const c of REVENUE_CHANNELS) byChannel.set(c, { channel: c, amount: 0, orders: 0 });
  let totalAmount = 0;
  let totalOrders = 0;
  for (const r of periodRevenues) {
    const agg = byStore.get(r.storeId) ?? { storeId: r.storeId, name: r.store.name, amount: 0, orders: 0 };
    agg.amount += Number(r.amount);
    agg.orders += r.orderCount;
    byStore.set(r.storeId, agg);
    const channelAgg = byChannel.get(r.channel) ?? { channel: r.channel, amount: 0, orders: 0 };
    channelAgg.amount += Number(r.amount);
    channelAgg.orders += r.orderCount;
    byChannel.set(r.channel, channelAgg);
    totalAmount += Number(r.amount);
    totalOrders += r.orderCount;
  }
  const storeAggs = [...byStore.values()].sort((a, b) => b.amount - a.amount);
  const channelAggs = [...byChannel.values()].sort((a, b) => b.amount - a.amount);
  const overallTicket = totalOrders > 0 ? totalAmount / totalOrders : null;

  // Um lançamento (total + iFood + 99Food + loja própria) vira 3 registros de
  // Revenue, um por canal — agrupa de volta por dia/loja pra listar como uma
  // linha só, com o valor de cada canal em sua própria coluna.
  type PeriodEntry = {
    date: string;
    storeId: string;
    storeName: string;
    totalAmount: number;
    totalOrders: number;
    ifoodAmount: number;
    food99Amount: number;
    lojaAmount: number;
    note: string | null;
  };
  const periodEntries = new Map<string, PeriodEntry>();
  for (const r of periodRevenues) {
    const dateISO = r.date.toISOString().slice(0, 10);
    const key = `${dateISO}_${r.storeId}`;
    const entry = periodEntries.get(key) ?? {
      date: dateISO,
      storeId: r.storeId,
      storeName: r.store.name,
      totalAmount: 0,
      totalOrders: 0,
      ifoodAmount: 0,
      food99Amount: 0,
      lojaAmount: 0,
      note: null,
    };
    const amount = Number(r.amount);
    entry.totalAmount += amount;
    entry.totalOrders += r.orderCount;
    if (r.channel === "IFOOD") entry.ifoodAmount += amount;
    else if (r.channel === "NOVENTA_NOVE") entry.food99Amount += amount;
    else entry.lojaAmount += amount;
    if (r.note) entry.note = r.note;
    periodEntries.set(key, entry);
  }
  const periodEntryList = [...periodEntries.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // --- Dashboard (ano) ---
  const summary = buildYearlySummary(
    yearRevenues.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      storeId: r.storeId,
      storeName: r.store.name,
      channel: r.channel,
      amount: Number(r.amount),
      orderCount: r.orderCount,
    })),
    stores.map((s) => ({ id: s.id, name: s.name })),
  );
  const storesByAmount = [...summary.stores].sort((a, b) => b.totalAmount - a.totalAmount);
  // Canais de verdade (não uma lista fixa) — qualquer canal novo que apareça
  // nos dados (Rappi, WhatsApp etc) entra sozinho nas tabelas por canal.
  const channels = summary.channelTotals.map((c) => c.channel);

  // Loja/marca cadastrada dentro do canal (ex: duas marcas no mesmo iFood) —
  // só aparece quando a SaiPos manda essa informação (partner_sale).
  type ChannelStoreAgg = { channel: string; channelStore: string; amount: number; orders: number };
  const byChannelStore = new Map<string, ChannelStoreAgg>();
  for (const r of yearRevenues) {
    if (!r.channelStore) continue;
    const key = `${r.channel}|${r.channelStore}`;
    const agg = byChannelStore.get(key) ?? {
      channel: r.channel,
      channelStore: r.channelStore,
      amount: 0,
      orders: 0,
    };
    agg.amount += Number(r.amount);
    agg.orders += r.orderCount;
    byChannelStore.set(key, agg);
  }
  const channelStoreAggs = [...byChannelStore.values()].sort((a, b) => b.amount - a.amount);

  // Crescimento vs. o ano anterior — dá uma noção rápida de tendência sem
  // precisar abrir os gráficos mensais.
  const prevYearAmount = Number(prevYearAgg._sum.amount ?? 0);
  const prevYearOrders = prevYearAgg._sum.orderCount ?? 0;
  const prevYearTicket = prevYearOrders > 0 ? prevYearAmount / prevYearOrders : null;
  const growth = (current: number, previous: number) =>
    previous > 0 ? (current - previous) / previous : null;
  const amountGrowth = growth(summary.totalAmount, prevYearAmount);
  const ordersGrowth = growth(summary.totalOrders, prevYearOrders);
  const ticketGrowth = prevYearTicket !== null ? growth(summary.overallTicket, prevYearTicket) : null;

  const channelShare = (channelAmount: number) =>
    summary.totalAmount > 0 ? channelAmount / summary.totalAmount : 0;

  const dailyRecordsByStore = new Map<
    string,
    { date: string; amount: number; orders: number; channel: string; channelStore: string }[]
  >();
  for (const r of yearRevenues) {
    const list = dailyRecordsByStore.get(r.storeId) ?? [];
    list.push({
      date: r.date.toISOString().slice(0, 10),
      amount: Number(r.amount),
      orders: r.orderCount,
      channel: r.channel,
      channelStore: r.channelStore,
    });
    dailyRecordsByStore.set(r.storeId, list);
  }

  // --- Histórico (todos os anos) ---
  type YearAgg = { amount: number; orders: number };
  const byYear = new Map<number, YearAgg>();
  const byYearStore = new Map<string, YearAgg>(); // key: `${year}_${storeId}`
  for (const r of allRevenues) {
    const y = r.date.getUTCFullYear();
    const amount = Number(r.amount);
    const yAgg = byYear.get(y) ?? { amount: 0, orders: 0 };
    yAgg.amount += amount;
    yAgg.orders += r.orderCount;
    byYear.set(y, yAgg);
    const key = `${y}_${r.storeId}`;
    const ysAgg = byYearStore.get(key) ?? { amount: 0, orders: 0 };
    ysAgg.amount += amount;
    ysAgg.orders += r.orderCount;
    byYearStore.set(key, ysAgg);
  }
  const historyYears = [...byYear.keys()].sort((a, b) => a - b);
  const yearlyTotals = historyYears.map((y) => ({ year: y, ...byYear.get(y)! }));
  const historyTotalAmount = yearlyTotals.reduce((sum, y) => sum + y.amount, 0);
  const historyTotalOrders = yearlyTotals.reduce((sum, y) => sum + y.orders, 0);
  const bestYear = yearlyTotals.reduce<{ year: number; amount: number } | null>(
    (best, y) => (!best || y.amount > best.amount ? { year: y.year, amount: y.amount } : best),
    null,
  );

  const storeYearly = stores.map((s) => ({
    storeId: s.id,
    storeName: s.name,
    years: historyYears.map((y) => ({ year: y, ...(byYearStore.get(`${y}_${s.id}`) ?? { amount: 0, orders: 0 }) })),
  }));
  const allTimeRanking = storeYearly
    .map((s) => {
      const amount = s.years.reduce((sum, y) => sum + y.amount, 0);
      const orders = s.years.reduce((sum, y) => sum + y.orders, 0);
      return { storeId: s.storeId, storeName: s.storeName, amount, orders, ticket: orders > 0 ? amount / orders : null };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const championStore = allTimeRanking[0] ?? null;

  // Projeção (rede toda) — mesmo histórico usado no Histórico, só que sem
  // agrupar por ano, pra função de projeção enxergar mês a mês.
  const allRecordsFlat = allRevenues.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    amount: Number(r.amount),
  }));
  const networkProjection = computeRevenueProjection(allRecordsFlat);

  const allDailyAmountsByStore = new Map<string, { date: string; amount: number }[]>();
  for (const r of allRevenues) {
    const list = allDailyAmountsByStore.get(r.storeId) ?? [];
    list.push({ date: r.date.toISOString().slice(0, 10), amount: Number(r.amount) });
    allDailyAmountsByStore.set(r.storeId, list);
  }

  // Lojas com token da SaiPos configurado (em Lojas) podem importar faturamento.
  const saiposStores = stores
    .filter((s) => s.saiposToken)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Faturamento</h1>
          <p className="text-sm text-neutral-500">
            Faturamento, pedidos e ticket médio de cada loja.
          </p>
        </div>
        <DailyRevenueDialog stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      <Tabs defaultValue={activeTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            {storesByAmount.map((s) => (
              <TabsTrigger key={s.storeId} value={`store-${s.storeId}`}>
                {s.storeName}
              </TabsTrigger>
            ))}
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex flex-col gap-6 pt-4">
          {year === new Date().getFullYear() && <AiAnalysisPanel action={analisarFinanceiro} />}
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

          <SectionHeading
            title="Visão geral"
            description={`Total de ${year}, com variação em relação a ${year - 1}.`}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">💰 Faturamento total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{currency(summary.totalAmount)}</p>
                <TrendBadge value={amountGrowth} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">📦 Total de pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{summary.totalOrders.toLocaleString("pt-BR")}</p>
                <TrendBadge value={ordersGrowth} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🎫 Ticket médio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{currency(summary.overallTicket)}</p>
                <TrendBadge value={ticketGrowth} />
              </CardContent>
            </Card>
          </div>

          {year === networkProjection.year && (
            <>
              <Separator />
              <SectionHeading
                title="Projeção"
                description="Com base no ritmo do mês e no crescimento observado esse ano vs. o anterior."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-neutral-500">
                      🔮 Projeção de fechamento do ano
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{currency(networkProjection.yearProjectedTotal)}</p>
                    <p className="text-xs text-neutral-500">
                      {currency(networkProjection.yearActualSoFar)} já faturado
                      {networkProjection.growthRate !== null && (
                        <> · crescimento de {percent(networkProjection.growthRate)} vs {year - 1}</>
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-neutral-500">
                      📅 Projeção do mês — {MONTH_NAMES_SHORT[networkProjection.currentMonth]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{currency(networkProjection.currentMonthProjected)}</p>
                    <p className="text-xs text-neutral-500">
                      {currency(networkProjection.currentMonthActual)} já faturado nesse mês
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Separator />

          <SectionHeading
            title="Por canal"
            description="Quanto do faturamento vem da loja própria vs. iFood e 99Food."
          />
          <Card>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>Faturamento</TableHead>
                      <TableHead>% do total</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.channelTotals.every((c) => c.amount === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-neutral-500">
                          Sem dados em {year}.
                        </TableCell>
                      </TableRow>
                    )}
                    {summary.channelTotals.map((c) => {
                      const ticket = c.orders > 0 ? c.amount / c.orders : null;
                      return (
                        <TableRow key={c.channel}>
                          <TableCell className="font-medium">
                            <ChannelBadge channel={c.channel} />
                          </TableCell>
                          <TableCell>{currency(c.amount)}</TableCell>
                          <TableCell className="text-neutral-500">{percent(channelShare(c.amount))}</TableCell>
                          <TableCell className="text-neutral-500">{c.orders.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-neutral-500">
                            {ticket !== null ? currency(ticket) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const marketplaceShare =
                  channelShare(
                    summary.channelTotals.find((c) => c.channel === "IFOOD")?.amount ?? 0,
                  ) +
                  channelShare(
                    summary.channelTotals.find((c) => c.channel === "NOVENTA_NOVE")?.amount ?? 0,
                  );
                return marketplaceShare > 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">
                    📱 iFood + 99Food representam <span className="font-medium text-foreground">{percent(marketplaceShare)}</span>{" "}
                    do faturamento de {year} — vale de olho na taxa de cada plataforma na hora de
                    precificar.
                  </p>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {channelStoreAggs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏪 Lojas/marcas dentro de cada canal</CardTitle>
                <p className="text-sm text-neutral-500">
                  Quando o canal tem mais de uma loja cadastrada nele (ex: duas marcas no mesmo
                  iFood), o faturamento de cada uma aparece separado aqui.
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead>Loja/marca no canal</TableHead>
                        <TableHead>Faturamento</TableHead>
                        <TableHead>Pedidos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelStoreAggs.map((c) => (
                        <TableRow key={`${c.channel}|${c.channelStore}`}>
                          <TableCell>
                            <ChannelBadge channel={c.channel} />
                          </TableCell>
                          <TableCell className="font-medium">{c.channelStore}</TableCell>
                          <TableCell>{currency(c.amount)}</TableCell>
                          <TableCell className="text-neutral-500">
                            {c.orders.toLocaleString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <SectionHeading title="Destaques do ano" description="Melhores lojas e ranking composto." />
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

          <Separator />

          <SectionHeading title="Gráficos" description="Tendência mensal e participação de cada loja e canal." />
          <FinanceiroCharts
            monthlyTotals={summary.monthlyTotals}
            stores={storesByAmount.map((s) => ({
              storeId: s.storeId,
              storeName: s.storeName,
              totalAmount: s.totalAmount,
              months: s.months.map((m) => ({ month: m.month, amount: m.amount })),
            }))}
            channelTotals={summary.channelTotals}
            channelMonthly={summary.channelMonthly}
          />

          <Separator />

          <SectionHeading
            title="Detalhamento mensal"
            description="Mês a mês, por loja e por canal — use pra investigar um período específico."
          />

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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📱 Faturamento mensal por canal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {channels.map((channel) => (
                        <TableHead key={channel}>
                          <ChannelBadge channel={channel} />
                        </TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {channels.map((channel) => (
                          <TableCell key={channel} className="text-neutral-500">
                            {currency(summary.channelMonthly[channel]?.[month]?.amount ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium">
                          {currency(summary.monthlyTotals[month].amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {channels.map((channel) => (
                        <TableCell key={channel} className="font-semibold">
                          {currency(
                            summary.channelTotals.find((c) => c.channel === channel)?.amount ?? 0,
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-primary">
                        {currency(summary.totalAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📱 % de participação por canal, mês a mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {channels.map((channel) => (
                        <TableHead key={channel}>
                          <ChannelBadge channel={channel} />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => {
                      const monthTotal = summary.monthlyTotals[month].amount;
                      return (
                        <TableRow key={month}>
                          <TableCell className="font-medium">{label}</TableCell>
                          {channels.map((channel) => {
                            const channelAmount = summary.channelMonthly[channel]?.[month]?.amount ?? 0;
                            return (
                              <TableCell key={channel} className="text-neutral-500">
                                {monthTotal > 0 ? percent(channelAmount / monthTotal) : "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Ano</TableCell>
                      {channels.map((channel) => (
                        <TableCell key={channel} className="font-semibold text-primary">
                          {percent(channelShare(summary.channelTotals.find((c) => c.channel === channel)?.amount ?? 0))}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📱 Pedidos mensais por canal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      {channels.map((channel) => (
                        <TableHead key={channel}>
                          <ChannelBadge channel={channel} />
                        </TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES_SHORT.map((label, month) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{label}</TableCell>
                        {channels.map((channel) => (
                          <TableCell key={channel} className="text-neutral-500">
                            {(summary.channelMonthly[channel]?.[month]?.orders ?? 0).toLocaleString("pt-BR")}
                          </TableCell>
                        ))}
                        <TableCell className="font-medium">
                          {summary.monthlyTotals[month].orders.toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {channels.map((channel) => (
                        <TableCell key={channel} className="font-semibold">
                          {(
                            summary.channelTotals.find((c) => c.channel === channel)?.orders ?? 0
                          ).toLocaleString("pt-BR")}
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
        </TabsContent>

        <TabsContent value="historico" className="flex flex-col gap-6 pt-4">
          <SectionHeading
            title="Histórico da rede"
            description={`Todos os anos com dados (${historyYears[0] ?? "—"}–${historyYears[historyYears.length - 1] ?? "—"}), todas as lojas juntas.`}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">💰 Faturamento total histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{currency(historyTotalAmount)}</p>
                <p className="text-xs text-neutral-500">{historyTotalOrders.toLocaleString("pt-BR")} pedidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🏆 Melhor ano</CardTitle>
              </CardHeader>
              <CardContent>
                {bestYear ? (
                  <>
                    <p className="text-2xl font-semibold">{bestYear.year}</p>
                    <p className="text-xs text-primary">{currency(bestYear.amount)}</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Sem dados.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-neutral-500">🥇 Loja campeã da rede</CardTitle>
              </CardHeader>
              <CardContent>
                {championStore ? (
                  <>
                    <p className="text-xl font-semibold">{championStore.storeName}</p>
                    <p className="text-xs text-primary">{currency(championStore.amount)} no total</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Sem dados.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <HistoricoCharts yearlyTotals={yearlyTotals} storeYearly={storeYearly} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🏅 Ranking histórico — todas as lojas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Faturamento total</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTimeRanking.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-neutral-500">
                          Sem dados ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {allTimeRanking.map((s, i) => (
                      <TableRow key={s.storeId}>
                        <TableCell>{MEDALS[i] ?? `${i + 1}º`}</TableCell>
                        <TableCell className="font-medium">{s.storeName}</TableCell>
                        <TableCell>{currency(s.amount)}</TableCell>
                        <TableCell className="text-neutral-500">{s.orders.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-neutral-500">
                          {s.ticket !== null ? currency(s.ticket) : "—"}
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
              <CardTitle className="text-lg">Faturamento por ano e por loja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ano</TableHead>
                      {storeYearly.map((s) => (
                        <TableHead key={s.storeId}>{s.storeName}</TableHead>
                      ))}
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyYears.map((y) => (
                      <TableRow key={y}>
                        <TableCell className="font-medium">{y}</TableCell>
                        {storeYearly.map((s) => {
                          const amount = s.years.find((yy) => yy.year === y)?.amount ?? 0;
                          return (
                            <TableCell key={s.storeId} className="text-neutral-500">
                              {amount > 0 ? currency(amount) : "—"}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-medium">{currency(byYear.get(y)?.amount ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {storeYearly.map((s) => (
                        <TableCell key={s.storeId} className="font-semibold">
                          {currency(s.years.reduce((sum, y) => sum + y.amount, 0))}
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-primary">{currency(historyTotalAmount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {storesByAmount.map((s) => (
          <TabsContent key={s.storeId} value={`store-${s.storeId}`} className="flex flex-col gap-6 pt-4">
            <div className="flex items-center justify-between rounded-lg border bg-white p-3">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`/financeiro?tab=store-${s.storeId}&year=${year - 1}`} />}
              >
                ← {year - 1}
              </Button>
              <p className="text-sm font-medium">
                {s.storeName} — {year}
              </p>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`/financeiro?tab=store-${s.storeId}&year=${year + 1}`} />}
              >
                {year + 1} →
              </Button>
            </div>
            <StoreDashboard
              store={s}
              year={year}
              dailyRecords={dailyRecordsByStore.get(s.storeId) ?? []}
              allDailyAmounts={allDailyAmountsByStore.get(s.storeId) ?? []}
            />
          </TabsContent>
        ))}

        <TabsContent value="lancamentos" className="flex flex-col gap-6 pt-4">
          {saiposStores.length > 0 && <SaiposSync stores={saiposStores} />}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500" htmlFor="storeId">
                Loja
              </label>
              <select id="storeId" name="storeId" defaultValue={storeIdParam ?? ""} className={selectClassName}>
                <option value="">Todas as lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
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
              <CardTitle className="text-lg">Por canal no período</CardTitle>
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
                    {channelAggs.every((c) => c.amount === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-neutral-500">
                          Nenhum lançamento nesse período.
                        </TableCell>
                      </TableRow>
                    )}
                    {channelAggs.map((c) => {
                      const ticket = c.orders > 0 ? c.amount / c.orders : null;
                      return (
                        <TableRow key={c.channel}>
                          <TableCell className="font-medium">
                            <ChannelBadge channel={c.channel} />
                          </TableCell>
                          <TableCell>{currency(c.amount)}</TableCell>
                          <TableCell className="text-neutral-500">{c.orders}</TableCell>
                          <TableCell className="text-neutral-500">
                            {ticket !== null ? currency(ticket) : "—"}
                          </TableCell>
                          <TableCell className="text-neutral-500">
                            {totalAmount > 0 ? percent(c.amount / totalAmount) : "—"}
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
              <CardTitle className="text-lg">Lançamentos do período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>
                        <ChannelBadge channel="IFOOD" />
                      </TableHead>
                      <TableHead>
                        <ChannelBadge channel="NOVENTA_NOVE" />
                      </TableHead>
                      <TableHead>Loja própria</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Ticket médio</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodEntryList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-neutral-500">
                          Nenhum faturamento lançado nesse período.
                        </TableCell>
                      </TableRow>
                    )}
                    {periodEntryList.map((entry) => {
                      const ticket = entry.totalOrders > 0 ? entry.totalAmount / entry.totalOrders : null;
                      return (
                        <TableRow key={`${entry.date}_${entry.storeId}`}>
                          <TableCell>{entry.date.split("-").reverse().join("/")}</TableCell>
                          <TableCell className="font-medium">{entry.storeName}</TableCell>
                          <TableCell className="text-neutral-500">{currency(entry.ifoodAmount)}</TableCell>
                          <TableCell className="text-neutral-500">{currency(entry.food99Amount)}</TableCell>
                          <TableCell className="text-neutral-500">{currency(entry.lojaAmount)}</TableCell>
                          <TableCell className="font-medium">{currency(entry.totalAmount)}</TableCell>
                          <TableCell className="text-neutral-500">{entry.totalOrders || "—"}</TableCell>
                          <TableCell className="text-neutral-500">
                            {ticket !== null ? currency(ticket) : "—"}
                          </TableCell>
                          <TableCell className="text-neutral-500">{entry.note ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <DailyRevenueDialog
                                stores={stores.map((s) => ({ id: s.id, name: s.name }))}
                                initialDate={entry.date}
                                initialStoreId={entry.storeId}
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    Editar
                                  </Button>
                                }
                              />
                              <DeleteRevenueButton storeId={entry.storeId} date={entry.date} />
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
