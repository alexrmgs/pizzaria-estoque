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
import { COINS } from "./coins";
import { EntradaForm, SaidaForm, MoedaForm, MesDialog, ExcluirLinha } from "./forms";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

export default async function CaixaDinheiroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canViewRelatorios");
  const params = await searchParams;

  const now = new Date();
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const [ano, mes] = mesParam?.match(/^\d{4}-\d{2}$/)
    ? mesParam.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const monthKey = `${ano}-${String(mes).padStart(2, "0")}`;
  const monthStart = new Date(Date.UTC(ano, mes - 1, 1));
  const monthEnd = new Date(Date.UTC(ano, mes, 0, 23, 59, 59));
  const mesLabel = monthStart.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prevMes = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
  const nextMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);
  const hojeISO = now.toISOString().slice(0, 10);

  const [config, entries, coins] = await Promise.all([
    prisma.cashMonth.findUnique({ where: { month: monthKey } }),
    prisma.cashEntry.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.coinMovement.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const saldoInicial = Number(config?.saldoInicial ?? 0);
  const entradas = entries.filter((e) => e.direction === "ENTRADA");
  const saidas = entries.filter((e) => e.direction === "SAIDA");
  const totalEntradas = entradas.reduce((s, e) => s + Number(e.amount), 0);
  const totalPagamentos = saidas
    .filter((e) => e.tipo === "PAGAMENTO")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalFundo = saidas
    .filter((e) => e.tipo === "FUNDO")
    .reduce((s, e) => s + Number(e.amount), 0);
  const saldoAtual = saldoInicial + totalEntradas - totalPagamentos - totalFundo;

  // Controle de moedas: qtd atual por denominação = inicial + entradas − saídas.
  const coinStats = COINS.map((c) => {
    const ini = Number(config?.[c.ini] ?? 0);
    const ent = coins
      .filter((m) => m.direction === "ENTRADA")
      .reduce((s, m) => s + (m[c.q] as number), 0);
    const sai = coins
      .filter((m) => m.direction === "SAIDA")
      .reduce((s, m) => s + (m[c.q] as number), 0);
    const qtd = ini + ent - sai;
    return { ...c, ini, ent, sai, qtd, total: qtd * c.value };
  });
  const totalMoedas = coinStats.reduce((s, c) => s + c.total, 0);

  // Conferência de virada (opcional): sistema × contagem física.
  const cedulasContadas = config?.cedulasContadas != null ? Number(config.cedulasContadas) : null;
  const moedasContadas = config?.moedasContadas != null ? Number(config.moedasContadas) : null;
  const temConferencia = cedulasContadas != null || moedasContadas != null;
  const totalContado = (cedulasContadas ?? 0) + (moedasContadas ?? 0);
  const divergencia = totalContado - saldoAtual;

  const configForm = {
    month: monthKey,
    saldoInicial,
    ini05: Number(config?.ini05 ?? 0),
    ini10: Number(config?.ini10 ?? 0),
    ini25: Number(config?.ini25 ?? 0),
    ini50: Number(config?.ini50 ?? 0),
    ini100: Number(config?.ini100 ?? 0),
    cedulasContadas,
    moedasContadas,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Caixa de Dinheiro</h1>
          <p className="text-sm text-neutral-500">
            Controle do dinheiro em espécie (cédulas e moedas) — igual sua planilha.
          </p>
        </div>
        <MesDialog config={configForm} />
      </div>

      <div className="flex items-center gap-3">
        <a href={`/caixa-dinheiro?mes=${prevMes}`} className="rounded-md border px-2 py-1 text-sm">
          ←
        </a>
        <span className="text-sm font-semibold capitalize">{mesLabel}</span>
        <a href={`/caixa-dinheiro?mes=${nextMes}`} className="rounded-md border px-2 py-1 text-sm">
          →
        </a>
      </div>

      {/* RESUMO */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-neutral-500">Saldo inicial</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{currency(saldoInicial)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-neutral-500">Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-600">{currency(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-neutral-500">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{currency(totalPagamentos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-neutral-500">Fundo de caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-amber-600">{currency(totalFundo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-neutral-500">Saldo atual</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={
                "text-xl font-bold " + (saldoAtual >= 0 ? "text-emerald-600" : "text-red-600")
              }
            >
              {currency(saldoAtual)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="movimento" className="w-full">
        <TabsList>
          <TabsTrigger value="movimento">Movimento</TabsTrigger>
          <TabsTrigger value="moedas">Controle de Moedas</TabsTrigger>
          <TabsTrigger value="virada">Virada de Mês</TabsTrigger>
        </TabsList>

        {/* MOVIMENTO — entradas e saídas */}
        <TabsContent value="movimento" className="flex flex-col gap-6 pt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ENTRADAS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-neutral-500">Entradas</h2>
                <span className="text-sm font-bold text-emerald-600">
                  {currency(totalEntradas)}
                </span>
              </div>
              <EntradaForm hoje={hojeISO} />
              <div className="rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-neutral-500">
                          Nenhuma entrada neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                    {entradas.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{brDate(e.date)}</TableCell>
                        <TableCell className="font-medium">{e.description}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {currency(Number(e.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          <ExcluirLinha id={e.id} tipo="entrada" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* SAÍDAS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-neutral-500">Saídas</h2>
                <span className="text-sm font-bold text-red-600">
                  {currency(totalPagamentos + totalFundo)}
                </span>
              </div>
              <SaidaForm hoje={hojeISO} />
              <div className="rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saidas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-neutral-500">
                          Nenhuma saída neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                    {saidas.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{brDate(e.date)}</TableCell>
                        <TableCell className="font-medium">{e.description}</TableCell>
                        <TableCell>
                          <Badge variant={e.tipo === "FUNDO" ? "secondary" : "outline"}>
                            {e.tipo === "FUNDO" ? "Fundo" : "Pagamento"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {currency(Number(e.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          <ExcluirLinha id={e.id} tipo="entrada" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CONTROLE DE MOEDAS */}
        <TabsContent value="moedas" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Estoque de moedas</CardTitle>
              <p className="text-xs text-neutral-500">
                Quantidade atual de cada moeda = estoque inicial do mês + entradas − saídas. Ajuste o
                estoque inicial no botão <b>Configurar mês</b>.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moeda</TableHead>
                      <TableHead className="text-right">Inicial</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Saídas</TableHead>
                      <TableHead className="text-right">Qtd atual</TableHead>
                      <TableHead className="text-right">Total (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coinStats.map((c) => (
                      <TableRow key={c.q}>
                        <TableCell className="font-medium">{c.label}</TableCell>
                        <TableCell className="text-right">{c.ini}</TableCell>
                        <TableCell className="text-right text-emerald-600">+{c.ent}</TableCell>
                        <TableCell className="text-right text-red-600">−{c.sai}</TableCell>
                        <TableCell className="text-right font-bold">{c.qtd}</TableCell>
                        <TableCell className="text-right font-medium">{currency(c.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold uppercase" colSpan={4}>
                        Total em moedas
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {coinStats.reduce((s, c) => s + c.qtd, 0)}
                      </TableCell>
                      <TableCell className="text-right font-bold">{currency(totalMoedas)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase text-neutral-500">
              Movimentação diária de moedas
            </h2>
            <MoedaForm hoje={hojeISO} />
            <div className="rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    {COINS.map((c) => (
                      <TableHead key={c.q} className="text-right">
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-neutral-500">
                        Nenhuma movimentação de moeda neste mês.
                      </TableCell>
                    </TableRow>
                  )}
                  {coins.map((m) => {
                    const totalRs = COINS.reduce(
                      (s, c) => s + (m[c.q] as number) * c.value,
                      0,
                    );
                    return (
                      <TableRow key={m.id}>
                        <TableCell>{brDate(m.date)}</TableCell>
                        <TableCell>
                          <Badge variant={m.direction === "ENTRADA" ? "outline" : "secondary"}>
                            {m.direction === "ENTRADA" ? "Entrada" : "Saída"}
                          </Badge>
                        </TableCell>
                        {COINS.map((c) => (
                          <TableCell key={c.q} className="text-right">
                            {(m[c.q] as number) || "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium">{currency(totalRs)}</TableCell>
                        <TableCell className="text-right">
                          <ExcluirLinha id={m.id} tipo="moeda" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* VIRADA DE MÊS */}
        <TabsContent value="virada" className="flex flex-col gap-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conferência de virada de mês</CardTitle>
              <p className="text-xs text-neutral-500">
                Conte o dinheiro físico (cédulas + moedas) e compare com o saldo do sistema. Informe
                a contagem no botão <b>Configurar mês</b>.
              </p>
            </CardHeader>
            <CardContent>
              {!temConferencia ? (
                <p className="text-sm text-neutral-500">
                  Ainda não informou a contagem física deste mês.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-neutral-500">Cédulas contadas</p>
                    <p className="text-lg font-bold">{currency(cedulasContadas ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Moedas contadas</p>
                    <p className="text-lg font-bold">{currency(moedasContadas ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Total contado (físico)</p>
                    <p className="text-lg font-bold">{currency(totalContado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">
                      Diferença (contado − sistema {currency(saldoAtual)})
                    </p>
                    <p
                      className={
                        "text-lg font-bold " +
                        (Math.abs(divergencia) < 0.01
                          ? "text-emerald-600"
                          : "text-red-600")
                      }
                    >
                      {currency(divergencia)}
                      {Math.abs(divergencia) >= 0.01 && (
                        <Badge variant="destructive" className="ml-2 align-middle">
                          divergência
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
