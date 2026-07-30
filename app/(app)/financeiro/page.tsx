import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;

  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : startOfCurrentMonth();
  const to = toParam ? new Date(`${toParam}T23:59:59`) : new Date();
  const fromISO = toISODate(from);
  const toISO = toISODate(to);

  const [stores, revenues] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.revenue.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      include: { store: { select: { name: true } } },
    }),
  ]);

  type StoreAgg = { storeId: string; name: string; amount: number; orders: number };
  const byStore = new Map<string, StoreAgg>();
  for (const store of stores) {
    byStore.set(store.id, { storeId: store.id, name: store.name, amount: 0, orders: 0 });
  }
  let totalAmount = 0;
  let totalOrders = 0;
  for (const r of revenues) {
    const agg = byStore.get(r.storeId) ?? { storeId: r.storeId, name: r.store.name, amount: 0, orders: 0 };
    agg.amount += Number(r.amount);
    agg.orders += r.orderCount;
    byStore.set(r.storeId, agg);
    totalAmount += Number(r.amount);
    totalOrders += r.orderCount;
  }
  const storeAggs = [...byStore.values()].sort((a, b) => b.amount - a.amount);
  const overallTicket = totalOrders > 0 ? totalAmount / totalOrders : null;

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

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
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
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/financeiro" />}>
          Mês atual
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Faturamento total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(totalAmount)}</p>
            <p className="text-xs text-neutral-500">Todas as lojas somadas no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalOrders}</p>
            <p className="text-xs text-neutral-500">Todas as lojas somadas no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Ticket médio geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {overallTicket !== null ? currency(overallTicket) : "—"}
            </p>
            <p className="text-xs text-neutral-500">
              {totalOrders === 0 ? "Lance a quantidade de pedidos pra calcular" : "Faturamento ÷ pedidos"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por loja</CardTitle>
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
                {revenues.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-neutral-500">
                      Nenhum faturamento lançado nesse período.
                    </TableCell>
                  </TableRow>
                )}
                {revenues.map((r) => {
                  const amount = Number(r.amount);
                  const ticket = r.orderCount > 0 ? amount / r.orderCount : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.date.toISOString().slice(0, 10).split("-").reverse().join("/")}</TableCell>
                      <TableCell className="font-medium">{r.store.name}</TableCell>
                      <TableCell>{currency(amount)}</TableCell>
                      <TableCell className="text-neutral-500">{r.orderCount || "—"}</TableCell>
                      <TableCell className="text-neutral-500">
                        {ticket !== null ? currency(ticket) : "—"}
                      </TableCell>
                      <TableCell className="text-neutral-500">{r.note ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <DeleteRevenueButton id={r.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
