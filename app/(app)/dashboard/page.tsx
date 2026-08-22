import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { LATE_TOLERANCE_MINUTES, todayInBrazil, weekdayInBrazil } from "@/lib/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DailyRevenueDialog } from "./daily-revenue-dialog";

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const canManageEstoque = user.role.canManageEstoque;
  const canManageFuncionarios = user.role.canManageFuncionarios;
  if (!canManageEstoque && !canManageFuncionarios) {
    redirect("/meu-ponto");
  }

  const params = await searchParams;

  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;

  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : startOfCurrentMonth();
  const to = toParam ? new Date(`${toParam}T23:59:59`) : new Date();
  const fromISO = toISODate(from);
  const toISO = toISODate(to);

  const [ingredients, recentMovements, lotesVencendoRaw] = canManageEstoque
    ? await Promise.all([
        prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
        prisma.stockMovement.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { ingredient: true, user: true },
        }),
        // Lote ainda em estoque (não baixado) com validade em até 3 dias, ou
        // já vencido — pra avisar antes de perder o produto.
        prisma.stockLabel.findMany({
          where: {
            status: "ATIVO",
            expiresAt: { lte: new Date(new Date().getTime() + 3 * 86_400_000) },
          },
          orderBy: { expiresAt: "asc" },
          take: 20,
          include: { ingredient: { select: { name: true, unit: true } } },
        }),
      ])
    : [[], [], []];

  const lowStock = ingredients.filter(
    (ingredient) => Number(ingredient.currentStock) < Number(ingredient.minStock),
  );
  const totalValue = ingredients.reduce(
    (sum, ingredient) => sum + Number(ingredient.currentStock) * Number(ingredient.unitPrice),
    0,
  );
  const hojeUTC = new Date();
  hojeUTC.setUTCHours(0, 0, 0, 0);
  const lotesVencendo = lotesVencendoRaw.map((l) => ({
    id: l.id,
    name: l.ingredient.name,
    unit: l.ingredient.unit,
    quantity: Number(l.quantity),
    expiresAt: l.expiresAt,
    vencido: l.expiresAt !== null && l.expiresAt.getTime() < hojeUTC.getTime(),
  }));

  const canViewRelatorios = canManageEstoque && user.role.canViewRelatorios;

  let periodContent = null;
  if (canViewRelatorios) {
    const [entradas, saidas, revenues, stores] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { type: "ENTRADA", createdAt: { gte: from, lte: to } },
        include: { ingredient: { include: { category: true } }, supplier: { select: { name: true } } },
      }),
      prisma.stockMovement.findMany({
        where: { type: "SAIDA", createdAt: { gte: from, lte: to }, ingredient: { includeInCmv: true } },
        include: { ingredient: true },
      }),
      prisma.revenue.findMany({
        // O estoque/CMV aqui é só da FB Eusébio — faturamento de outras
        // lojas não entra nessa conta pra não distorcer o CMV.
        where: {
          date: { gte: from, lte: to },
          store: { name: "FB EUSEBIO", companyId: user.companyId },
        },
        orderBy: { date: "desc" },
      }),
      prisma.store.findMany({
        where: { companyId: user.companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const custoSaidas = saidas.reduce(
      (sum, m) => sum + Number(m.quantity) * Number(m.ingredient.unitPrice),
      0,
    );
    const faturamentoTotal = revenues.reduce((sum, r) => sum + Number(r.amount), 0);
    const cmv = faturamentoTotal > 0 ? (custoSaidas / faturamentoTotal) * 100 : null;

    const diasNoPeriodo =
      Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    type Agg = { name: string; unit: string; qty: number; value: number };
    const porIngrediente = new Map<string, Agg>();
    const porCategoria = new Map<string, number>();
    const porFornecedor = new Map<string, number>();

    let comprasTotal = 0;
    for (const m of entradas) {
      const qty = Number(m.quantity);
      // Usa o preço travado na hora da entrada (informado ou o cadastrado
      // naquele momento); cai pro preço atual só em lançamentos antigos que
      // ainda não tinham esse registro.
      const unitPrice = m.unitPriceAtEntry !== null ? Number(m.unitPriceAtEntry) : Number(m.ingredient.unitPrice);
      const value = qty * unitPrice;
      comprasTotal += value;

      const current = porIngrediente.get(m.ingredientId) ?? {
        name: m.ingredient.name,
        unit: m.ingredient.unit,
        qty: 0,
        value: 0,
      };
      current.qty += qty;
      current.value += value;
      porIngrediente.set(m.ingredientId, current);

      const categoryName = m.ingredient.category?.name ?? "Sem categoria";
      porCategoria.set(categoryName, (porCategoria.get(categoryName) ?? 0) + value);

      if (m.supplier) {
        porFornecedor.set(m.supplier.name, (porFornecedor.get(m.supplier.name) ?? 0) + value);
      }
    }

    const topComprados = [...porIngrediente.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topGastoProduto = [...porIngrediente.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const topGastoCategoria = [...porCategoria.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topFornecedores = [...porFornecedor.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    periodContent = (
      <>
        <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="from">
              De
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={fromISO}
              className={selectClassName}
            />
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
          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/dashboard" />}>
            Mês atual
          </Button>
          <div className="ml-auto">
            <DailyRevenueDialog stores={stores} />
          </div>
        </form>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Faturamento no período (FB Eusébio)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{currency(faturamentoTotal)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {revenues.length} de {diasNoPeriodo} dia(s) lançado(s) — só a loja com esse estoque
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Compras no período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{currency(comprasTotal)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Preço de compra informado, ou o cadastrado quando deixado em branco
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Custo de saídas no período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{currency(custoSaidas)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Preço atual, só itens marcados para o CMV
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">CMV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">
                {cmv !== null ? `${cmv.toFixed(1)}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {cmv !== null
                  ? "Custo ÷ faturamento da FB Eusébio no período"
                  : "Lance o faturamento da FB Eusébio para calcular"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mais comprados (quantidade)</CardTitle>
            </CardHeader>
            <CardContent>
              {topComprados.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem entradas no período.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {topComprados.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between">
                      <span>
                        <span className="text-neutral-400">{index + 1}.</span> {item.name}
                      </span>
                      <span className="text-neutral-500">
                        {item.qty} {item.unit}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maior gasto por produto</CardTitle>
            </CardHeader>
            <CardContent>
              {topGastoProduto.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem entradas no período.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {topGastoProduto.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between">
                      <span>
                        <span className="text-neutral-400">{index + 1}.</span> {item.name}
                      </span>
                      <span className="font-medium">{currency(item.value)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maior gasto por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {topGastoCategoria.length === 0 ? (
                <p className="text-sm text-neutral-500">Sem entradas no período.</p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {topGastoCategoria.map(([name, value], index) => (
                    <li key={name} className="flex items-center justify-between">
                      <span>
                        <span className="text-neutral-400">{index + 1}.</span> {name}
                      </span>
                      <span className="font-medium">{currency(value)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking de fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              {topFornecedores.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Sem entradas com fornecedor marcado no período.
                </p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {topFornecedores.map(([name, value], index) => (
                    <li key={name} className="flex items-center justify-between">
                      <span>
                        <span className="text-neutral-400">{index + 1}.</span> {name}
                      </span>
                      <span className="font-medium">{currency(value)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  let rhContent = null;
  if (canManageFuncionarios) {
    const now = new Date();
    const todayStart = todayInBrazil(now);
    const todayEnd = new Date(
      Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), todayStart.getUTCDate(), 23, 59, 59),
    );
    const todayWeekday = weekdayInBrazil(now);

    const [activeEmployees, todayEntries, todayDayOffs] = await Promise.all([
      prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.timeEntry.findMany({ where: { date: { gte: todayStart, lte: todayEnd } } }),
      prisma.dayOff.findMany({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    ]);

    const entriesByEmployee = new Map<string, typeof todayEntries>();
    for (const entry of todayEntries) {
      const list = entriesByEmployee.get(entry.employeeId) ?? [];
      list.push(entry);
      entriesByEmployee.set(entry.employeeId, list);
    }
    const dayOffEmployeeIds = new Set(todayDayOffs.map((d) => d.employeeId));

    const working: { name: string; clockIn: Date }[] = [];
    const notClockedIn: typeof activeEmployees = [];
    for (const employee of activeEmployees) {
      const entries = entriesByEmployee.get(employee.id) ?? [];
      const openEntry = entries.find((e) => !e.clockOut);
      if (openEntry) {
        working.push({ name: employee.name, clockIn: openEntry.clockIn });
      } else if (entries.length === 0) {
        notClockedIn.push(employee);
      }
    }

    const onDayOffToday = activeEmployees.filter(
      (e) => e.weeklyDayOff === todayWeekday || dayOffEmployeeIds.has(e.id),
    );
    const onDayOffIds = new Set(onDayOffToday.map((e) => e.id));

    const possibleAbsences = notClockedIn.filter((employee) => {
      if (!employee.scheduledStart || onDayOffIds.has(employee.id)) return false;
      const [hour, minute] = employee.scheduledStart.split(":").map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hour, minute, 0, 0);
      return now.getTime() > scheduled.getTime() + LATE_TOLERANCE_MINUTES * 60_000;
    });

    rhContent = (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Equipe hoje
            {possibleAbsences.length > 0 && (
              <Badge variant="destructive">{possibleAbsences.length} possível falta</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">Trabalhando agora</p>
              <p className="text-lg font-semibold text-primary">
                {working.length} de {activeEmployees.length}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">De folga hoje</p>
              <p className="text-lg font-semibold">{onDayOffToday.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-neutral-500">Possível falta</p>
              <p className="text-lg font-semibold text-destructive">{possibleAbsences.length}</p>
            </div>
          </div>

          {working.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">Trabalhando agora</p>
              <ul className="flex flex-col gap-1 text-sm">
                {working.map((item) => (
                  <li key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="text-neutral-500">
                      desde{" "}
                      {item.clockIn.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {possibleAbsences.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-destructive">
                Ainda não bateram ponto hoje (já passou do horário previsto)
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {possibleAbsences.map((employee) => (
                  <li key={employee.id} className="flex items-center justify-between">
                    <span>{employee.name}</span>
                    <span className="text-neutral-500">previsto {employee.scheduledStart}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Baseado no ponto e no horário cadastrado de cada funcionário — não é uma falta
            confirmada automaticamente, é só um alerta. Confira antes de descontar em Pagamentos.
          </p>
          <Link href="/funcionarios" className="text-sm text-neutral-900 underline">
            Ver funcionários
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {user.name?.split(" ")[0]}</h1>
        <p className="text-sm text-neutral-500">Resumo da pizzaria.</p>
      </div>

      {rhContent}

      {canManageEstoque && (
        <>
          <Card className="w-fit">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-neutral-500">Valor total do estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-primary">{currency(totalValue)}</p>
            </CardContent>
          </Card>

          {periodContent}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Estoque baixo
                {lowStock.length > 0 && <Badge variant="destructive">{lowStock.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhum ingrediente abaixo do mínimo. 🎉</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lowStock.map((ingredient) => (
                    <li key={ingredient.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{ingredient.name}</span>
                      <span className="text-neutral-500">
                        {ingredient.currentStock.toString()} / {ingredient.minStock.toString()}{" "}
                        {ingredient.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/estoque" className="mt-4 inline-block text-sm text-neutral-900 underline">
                Ver estoque completo
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Vencendo / vencido
                {lotesVencendo.length > 0 && <Badge variant="destructive">{lotesVencendo.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lotesVencendo.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nenhum lote vencendo nos próximos 3 dias. 🎉
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lotesVencendo.map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{l.name}</span>
                      <span className={l.vencido ? "font-semibold text-destructive" : "text-amber-600"}>
                        {l.quantity} {l.unit} ·{" "}
                        {l.expiresAt?.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        {l.vencido && " (vencido)"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/etiquetas-producao"
                className="mt-4 inline-block text-sm text-neutral-900 underline"
              >
                Ver etiquetas / lotes
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Últimas movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMovements.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma movimentação registrada ainda.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {recentMovements.map((movement) => (
                    <li key={movement.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{movement.ingredient.name}</span>{" "}
                        <span className="text-neutral-500">
                          {movement.type === "ENTRADA" ? "+" : "-"}
                          {movement.quantity.toString()} {movement.ingredient.unit} ·{" "}
                          {movement.user.name}
                        </span>
                      </div>
                      <span className="text-neutral-400">
                        {movement.createdAt.toLocaleDateString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/movimentacoes"
                className="mt-4 inline-block text-sm text-neutral-900 underline"
              >
                Ver todas as movimentações
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
