import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolvePluggyCreds, getAccounts, getTransactions } from "@/lib/pluggy";
import { PayableDialog } from "./payable-dialog";
import { MarcarPagaButton, ReabrirButton, ExcluirButton } from "./payable-buttons";

export const maxDuration = 60;

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const currentUser = await requirePermission("canViewRelatorios");
  const params = await searchParams;

  const now = new Date();
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const [ano, mes] = mesParam?.match(/^\d{4}-\d{2}$/)
    ? mesParam.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const monthStart = new Date(Date.UTC(ano, mes - 1, 1));
  const monthEnd = new Date(Date.UTC(ano, mes, 0, 23, 59, 59));
  const mesLabel = monthStart.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prevMes = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
  const nextMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);

  const activeTab =
    params.tab === "pagar" || params.tab === "pagas" ? (params.tab as string) : "fluxo";

  // O financeiro (caixa/contas) é só da FB Eusébio — as outras lojas servem só
  // pra registrar faturamento. Então as entradas do fluxo contam só a Eusébio.
  const stores = await prisma.store.findMany({
    where: { companyId: currentUser.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, pluggyClientId: true, pluggyClientSecret: true },
  });
  const eusebio = stores.find((s) =>
    s.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .includes("eusebio"),
  );

  const [pendentes, pagasMes, revenueAgg] = await Promise.all([
    prisma.payable.findMany({
      where: { status: "PENDENTE", companyId: currentUser.companyId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payable.findMany({
      where: {
        status: "PAGA",
        paidDate: { gte: monthStart, lte: monthEnd },
        companyId: currentUser.companyId,
      },
      orderBy: { paidDate: "desc" },
    }),
    prisma.revenue.aggregate({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        ...(eusebio ? { storeId: eusebio.id } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const hoje = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const entradasMes = Number(revenueAgg._sum.amount ?? 0);
  const saidasMes = pagasMes.reduce((s, p) => s + Number(p.amount), 0);
  const saldoMes = entradasMes - saidasMes;
  const totalPendente = pendentes.reduce((s, p) => s + Number(p.amount), 0);
  const vencidas = pendentes.filter((p) => p.dueDate < hoje);
  const totalVencidas = vencidas.reduce((s, p) => s + Number(p.amount), 0);

  // Movimento REAL do banco (extrato Pluggy) no mês — só contas bancárias
  // (cartão de crédito fica de fora). É o dinheiro de verdade que entrou/saiu.
  // Obs: inclui transferência entre suas contas (pode contar 2x) e o
  // faturamento do cartão cai dias depois — por isso fica ao lado do gerencial.
  const monthStartISO = monthStart.toISOString().slice(0, 10);
  const monthEndISO = monthEnd.toISOString().slice(0, 10);
  const monthsBack =
    Math.max(0, (now.getUTCFullYear() - ano) * 12 + (now.getUTCMonth() + 1 - mes)) + 1;
  let bancoEntradas = 0;
  let bancoSaidas = 0;
  let bancoDisponivel = false;
  let bancoErro = false;
  const pluggyCreds = resolvePluggyCreds(eusebio);
  if (pluggyCreds) {
    try {
      const conns = eusebio
        ? await prisma.bankConnection.findMany({ where: { storeId: eusebio.id } })
        : [];
      for (const conn of conns) {
        const accounts = await getAccounts(pluggyCreds, conn.itemId);
        for (const acc of accounts) {
          if (acc.type === "CREDIT") continue;
          const txs = await getTransactions(pluggyCreds, acc.id, monthsBack);
          for (const t of txs) {
            const d = t.date.slice(0, 10);
            if (d < monthStartISO || d > monthEndISO) continue;
            if (t.amount >= 0) bancoEntradas += t.amount;
            else bancoSaidas += Math.abs(t.amount);
          }
          bancoDisponivel = true;
        }
      }
    } catch {
      bancoErro = true;
    }
  }
  const bancoSaldo = bancoEntradas - bancoSaidas;

  // Saídas do mês por categoria (pro fluxo de caixa).
  const porCategoria = new Map<string, number>();
  for (const p of pagasMes) {
    porCategoria.set(p.category, (porCategoria.get(p.category) ?? 0) + Number(p.amount));
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Financeiro</h1>
          <p className="text-sm text-neutral-500">
            Fluxo de caixa, contas a pagar e contas pagas.
          </p>
        </div>
        <PayableDialog stores={[]} />
      </div>

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="pagas">Contas Pagas</TabsTrigger>
        </TabsList>

        {/* FLUXO DE CAIXA */}
        <TabsContent value="fluxo" className="flex flex-col gap-4 pt-4">
          <div className="flex items-center gap-3">
            <a href={`/caixa?tab=fluxo&mes=${prevMes}`} className="rounded-md border px-2 py-1 text-sm">
              ←
            </a>
            <span className="text-sm font-semibold capitalize">{mesLabel}</span>
            <a href={`/caixa?tab=fluxo&mes=${nextMes}`} className="rounded-md border px-2 py-1 text-sm">
              →
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">
                  Entradas (faturamento FB Eusébio)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{currency(entradasMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">Saídas (contas pagas)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{currency(saidasMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">Saldo do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={
                    "text-2xl font-bold " + (saldoMes >= 0 ? "text-emerald-600" : "text-red-600")
                  }
                >
                  {currency(saldoMes)}
                </p>
              </CardContent>
            </Card>
          </div>

          {(bancoDisponivel || bancoErro) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Movimento real do banco</CardTitle>
                <p className="text-xs text-neutral-500">
                  Dinheiro que de fato entrou/saiu nas contas (extrato Open Finance). Inclui
                  transferência entre suas contas e o cartão cai dias depois — use como conferência.
                </p>
              </CardHeader>
              <CardContent>
                {bancoErro ? (
                  <p className="text-sm text-neutral-500">
                    Não consegui ler o extrato do banco agora. Tente atualizar em Bancos.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-neutral-500">Entradas</p>
                      <p className="text-xl font-bold text-emerald-600">{currency(bancoEntradas)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Saídas</p>
                      <p className="text-xl font-bold text-red-600">{currency(bancoSaidas)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Saldo do movimento</p>
                      <p
                        className={
                          "text-xl font-bold " +
                          (bancoSaldo >= 0 ? "text-emerald-600" : "text-red-600")
                        }
                      >
                        {currency(bancoSaldo)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saídas por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categorias.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma conta paga neste mês.</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorias.map(([cat, val]) => (
                        <TableRow key={cat}>
                          <TableCell>{cat}</TableCell>
                          <TableCell className="text-right font-medium">{currency(val)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTAS A PAGAR */}
        <TabsContent value="pagar" className="flex flex-col gap-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">Total a pagar</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{currency(totalPendente)}</p>
              </CardContent>
            </Card>
            <Card className={totalVencidas > 0 ? "border-destructive/40 bg-destructive/5" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-500">Vencidas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{currency(totalVencidas)}</p>
                <p className="text-xs text-neutral-500">{vencidas.length} conta(s)</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhuma conta a pagar. 🎉
                    </TableCell>
                  </TableRow>
                )}
                {pendentes.map((p) => {
                  const venceu = p.dueDate < hoje;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        {brDate(p.dueDate)}
                        {venceu && (
                          <Badge variant="destructive" className="ml-2">
                            vencida
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.description}</TableCell>
                      <TableCell className="text-neutral-500">{p.category}</TableCell>
                      <TableCell className="text-right font-medium">
                        {currency(Number(p.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          <MarcarPagaButton id={p.id} />
                          <PayableDialog
                            stores={[]}
                            payable={{
                              id: p.id,
                              description: p.description,
                              category: p.category,
                              amount: p.amount.toString(),
                              dueDate: p.dueDate.toISOString().slice(0, 10),
                              storeId: p.storeId,
                              note: p.note,
                            }}
                          />
                          <ExcluirButton id={p.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* CONTAS PAGAS */}
        <TabsContent value="pagas" className="flex flex-col gap-4 pt-4">
          <div className="flex items-center gap-3">
            <a href={`/caixa?tab=pagas&mes=${prevMes}`} className="rounded-md border px-2 py-1 text-sm">
              ←
            </a>
            <span className="text-sm font-semibold capitalize">{mesLabel}</span>
            <a href={`/caixa?tab=pagas&mes=${nextMes}`} className="rounded-md border px-2 py-1 text-sm">
              →
            </a>
            <span className="ml-auto text-sm">
              Total pago: <b>{currency(saidasMes)}</b>
            </span>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagasMes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhuma conta paga neste mês.
                    </TableCell>
                  </TableRow>
                )}
                {pagasMes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paidDate ? brDate(p.paidDate) : "—"}</TableCell>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell className="text-neutral-500">{p.category}</TableCell>
                    <TableCell className="text-right font-medium">
                      {currency(Number(p.amount))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <ReabrirButton id={p.id} />
                        <ExcluirButton id={p.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
