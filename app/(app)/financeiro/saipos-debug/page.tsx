import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { fetchSaiposSales, saiposChannel, saiposChannelStore } from "@/lib/saipos";
import { todayInBrazil } from "@/lib/payroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// A API da SaiPos é lenta (~28s por página de 1000 vendas) — sem isso a
// função estoura o tempo limite padrão da Vercel antes de terminar.
export const maxDuration = 300;

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function isValidDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function SaiposDebugPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; date?: string }>;
}) {
  const user = await requirePermission("canViewRelatorios");
  const { storeId, date } = await searchParams;

  const stores = await prisma.store.findMany({
    where: { companyId: user.companyId, saiposToken: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, saiposToken: true },
  });

  const selectedStoreId = storeId ?? stores[0]?.id ?? "";
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const selectedDate = isValidDate(date) ? date : todayInBrazil().toISOString().slice(0, 10);

  let sales: Awaited<ReturnType<typeof fetchSaiposSales>> = [];
  let fetchError: string | null = null;
  if (selectedStore?.saiposToken) {
    try {
      const start = new Date(`${selectedDate}T00:00:00Z`);
      const end = new Date(`${selectedDate}T00:00:00Z`);
      sales = await fetchSaiposSales(selectedStore.saiposToken, start, end);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Falha ao consultar a SaiPos.";
    }
  }

  const rows = sales
    .map((s) => ({
      id: String(s.id_sale),
      channel: saiposChannel(s),
      channelStore: saiposChannelStore(s),
      partnerRaw: s.partner_sale?.desc_partner_sale ?? "",
      amount: Number(s.total_amount) || 0,
      canceled: (s.canceled ?? "").toUpperCase() === "Y",
      shiftDate: s.shift_date,
      day: (s.shift_date ?? "").slice(0, 10),
    }))
    .sort((a, b) => a.amount - b.amount);

  const countById = new Map<string, number>();
  for (const r of rows) countById.set(r.id, (countById.get(r.id) ?? 0) + 1);
  const idDuplicado = (id: string) => (countById.get(id) ?? 0) > 1;

  const total = rows.filter((r) => !r.canceled).reduce((sum, r) => sum + r.amount, 0);
  const totalIfood = rows
    .filter((r) => !r.canceled && r.channel === "IFOOD")
    .reduce((sum, r) => sum + r.amount, 0);

  // Reproduz exatamente a mesma agregação + filtro de "descarta sem-marca
  // quando tem marca" que sincronizarSaipos faz, só pra comparar com o que
  // tá gravado no banco de verdade.
  type Bucket = { amount: number; count: number };
  const byDayChannel = new Map<string, Bucket>();
  for (const r of rows) {
    if (r.canceled) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.day)) continue;
    const key = JSON.stringify([r.day, r.channel, r.channelStore]);
    const bucket = byDayChannel.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += r.amount;
    bucket.count += 1;
    byDayChannel.set(key, bucket);
  }
  let simulado = Array.from(byDayChannel.entries(), ([key, bucket]) => {
    const [day, channel, channelStore] = JSON.parse(key) as [string, string, string];
    return { day, channel, channelStore, ...bucket };
  });
  const temMarcaSet = new Set(
    simulado.filter((e) => e.channelStore !== "").map((e) => `${e.day}|${e.channel}`),
  );
  const descartados = simulado.filter(
    (e) => e.channelStore === "" && temMarcaSet.has(`${e.day}|${e.channel}`),
  );
  simulado = simulado.filter(
    (e) => e.channelStore !== "" || !temMarcaSet.has(`${e.day}|${e.channel}`),
  );

  const dbRows = selectedStore
    ? await prisma.revenue.findMany({
        where: {
          storeId: selectedStore.id,
          date: new Date(`${selectedDate}T00:00:00Z`),
          note: "Importado da SaiPos",
        },
        orderBy: [{ channel: "asc" }, { channelStore: "asc" }],
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Diagnóstico SaiPos (vendas cruas)</h1>
        <p className="text-sm text-neutral-500">
          Lista cada venda como a API da SaiPos manda, sem agregar — pra achar duplicata de
          verdade. Linha em vermelho = mesmo id_sale apareceu mais de uma vez nessa busca.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="storeId">
            Loja
          </label>
          <select
            id="storeId"
            name="storeId"
            defaultValue={selectedStoreId}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="date">
            Dia
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={selectedDate}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Buscar
        </button>
      </form>

      {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}

      {!fetchError && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Total do dia (sem canceladas)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{currency(total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Total iFood</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{currency(totalIfood)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Vendas retornadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{rows.length}</p>
              <p className="text-xs text-neutral-500">
                {[...countById.values()].filter((c) => c > 1).length} id_sale repetido(s)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white">
          <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
            O que a lógica calcula agora (simulado)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Loja do canal</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulado.map((e) => (
                <TableRow key={`${e.channel}|${e.channelStore}`}>
                  <TableCell>{e.channel}</TableCell>
                  <TableCell className="text-neutral-500">{e.channelStore || "—"}</TableCell>
                  <TableCell>{currency(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {descartados.length > 0 && (
            <div className="border-t p-3 text-xs text-neutral-500">
              Descartado(s) por já ter marca: {descartados.map((d) => `${d.channel} ${currency(d.amount)}`).join(", ")}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white">
          <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
            O que tá gravado no banco de verdade
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Loja do canal</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell className="text-neutral-500">{r.channelStore || "—"}</TableCell>
                  <TableCell>{currency(Number(r.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>id_sale</TableHead>
              <TableHead>Canal (interpretado)</TableHead>
              <TableHead>Canal (cru da SaiPos)</TableHead>
              <TableHead>Loja do canal</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Cancelada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Nenhuma venda retornada pra esse dia.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={`${r.id}-${i}`} className={idDuplicado(r.id) ? "bg-destructive/10" : ""}>
                <TableCell className="font-mono text-xs">
                  {r.id}
                  {idDuplicado(r.id) && (
                    <Badge variant="destructive" className="ml-2">
                      duplicado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{r.channel}</TableCell>
                <TableCell className="text-neutral-500">{r.partnerRaw || "—"}</TableCell>
                <TableCell className="text-neutral-500">{r.channelStore || "—"}</TableCell>
                <TableCell>{currency(r.amount)}</TableCell>
                <TableCell className="text-neutral-500">{r.canceled ? "Sim" : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
