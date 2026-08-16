import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoteRowActions } from "../../lotes/lote-row-actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HISTORY_LIMIT = 200;

function isValidDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusValidade(expiresAt: Date | null): "vencido" | "perto" | "ok" | null {
  if (!expiresAt) return null;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const dias = Math.round((expiresAt.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return "vencido";
  if (dias <= 1) return "perto";
  return "ok";
}

export default async function IngredientHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requirePermission("canManageEstoque");
  const { id } = await params;
  const { from, to } = await searchParams;

  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!ingredient) notFound();

  const [lotes, settings] = await Promise.all([
    prisma.stockLabel.findMany({
      where: { ingredientId: id },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      take: 50,
    }),
    getAppSettings(user.companyId),
  ]);

  const hasRange = isValidDate(from) && isValidDate(to);
  const rangeStart = hasRange ? new Date(`${from}T00:00:00`) : null;
  const rangeEnd = hasRange ? new Date(`${to}T23:59:59.999`) : null;

  const movements = await prisma.stockMovement.findMany({
    where: {
      ingredientId: id,
      ...(hasRange ? { createdAt: { gte: rangeStart!, lte: rangeEnd! } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: hasRange ? undefined : HISTORY_LIMIT,
    include: { user: { select: { name: true } } },
  });

  const consumoPeriodo = hasRange
    ? movements.filter((m) => m.type === "SAIDA").reduce((sum, m) => sum + Number(m.quantity), 0)
    : null;
  const entradaPeriodo = hasRange
    ? movements.filter((m) => m.type === "ENTRADA").reduce((sum, m) => sum + Number(m.quantity), 0)
    : null;

  // Média semanal histórica (não depende do filtro De/Até): olha os últimos 90
  // dias de saída e divide pelo tempo real coberto, pra dar uma referência de
  // consumo típico por semana (ex: pra planejar compra).
  const janelaInicio = new Date();
  janelaInicio.setDate(janelaInicio.getDate() - 90);
  const saidasRecentes = await prisma.stockMovement.findMany({
    where: { ingredientId: id, type: "SAIDA", createdAt: { gte: janelaInicio } },
    orderBy: { createdAt: "asc" },
    select: { quantity: true, createdAt: true },
  });
  let mediaSemanal: number | null = null;
  if (saidasRecentes.length > 0) {
    const totalSaida = saidasRecentes.reduce((sum, m) => sum + Number(m.quantity), 0);
    const primeiraData = saidasRecentes[0].createdAt;
    const diasCobertos = Math.max(
      1,
      (new Date().getTime() - primeiraData.getTime()) / (1000 * 60 * 60 * 24),
    );
    mediaSemanal = totalSaida / (diasCobertos / 7);
  }

  const current = Number(ingredient.currentStock);
  const min = Number(ingredient.minStock);
  const low = current < min;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/estoque" className="text-sm text-neutral-500 hover:underline">
          ← Voltar pro estoque
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{ingredient.name}</h1>
          {low && <Badge variant="destructive">Estoque baixo</Badge>}
          {ingredient.isProduced && <Badge variant="secondary">Produzido internamente</Badge>}
        </div>
        <p className="text-sm text-neutral-500">
          {ingredient.category?.name ?? "Sem categoria"} · Unidade: {ingredient.unit}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Estoque atual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {current} {ingredient.unit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Estoque mínimo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {min} {ingredient.unit}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Preço cadastrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(Number(ingredient.unitPrice))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Valor em estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">
              {currency(current * Number(ingredient.unitPrice))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-neutral-500">Consumo médio semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {mediaSemanal !== null ? `${mediaSemanal.toFixed(1)} ${ingredient.unit}` : "—"}
            </p>
            <p className="text-xs text-neutral-500">últimos 90 dias</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consumo por período</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="from" className="text-xs text-neutral-500">De</label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="to" className="text-xs text-neutral-500">Até</label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Filtrar
            </button>
            {hasRange && (
              <Link href={`/estoque/${id}`} className="text-sm text-neutral-500 hover:underline">
                Limpar filtro
              </Link>
            )}
          </form>

          {hasRange && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-neutral-500">Consumo (saída) no período</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-destructive">
                    {consumoPeriodo} {ingredient.unit}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm text-neutral-500">Entrada no período</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {entradaPeriodo} {ingredient.unit}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lotes (validade)</CardTitle>
          <p className="text-xs text-neutral-500">
            Um lote por etiqueta impressa em Etiquetas / Lotes — cada um com o peso e validade
            daquela produção específica.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fabricação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhum lote registrado pra esse produto ainda.
                    </TableCell>
                  </TableRow>
                )}
                {lotes.map((l) => {
                  const validade = statusValidade(l.expiresAt);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-neutral-500">{formatDate(l.producedAt)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            validade === "vencido"
                              ? "font-semibold text-destructive"
                              : validade === "perto"
                                ? "font-semibold text-amber-600"
                                : ""
                          }
                        >
                          {formatDate(l.expiresAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {Number(l.quantity)} {ingredient.unit}
                      </TableCell>
                      <TableCell>
                        {l.status === "BAIXADO" ? (
                          <Badge variant="secondary">Baixado</Badge>
                        ) : validade === "vencido" ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800">Em estoque</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <LoteRowActions
                          lote={{
                            id: l.id,
                            ingredientName: ingredient.name,
                            unit: ingredient.unit,
                            quantity: Number(l.quantity),
                            producedAt: l.producedAt,
                            expiresAt: l.expiresAt,
                            status: l.status,
                          }}
                          empresa={{
                            nome: settings.labelEmpresa ?? "",
                            cnpj: settings.labelCnpj ?? "",
                            endereco: settings.labelEndereco ?? "",
                            cep: settings.labelCep ?? "",
                            cidade: settings.labelCidade ?? "",
                          }}
                          widthMm={settings.labelProducaoWidthMm}
                          heightMm={settings.labelProducaoHeightMm}
                        />
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
          <CardTitle className="text-lg">
            Histórico de movimentações{hasRange ? ` — ${from} a ${to}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Preço de compra</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Funcionário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-500">
                      Nenhuma movimentação registrada pra esse ingrediente ainda.
                    </TableCell>
                  </TableRow>
                )}
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{movement.createdAt.toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {movement.type === "ENTRADA" ? (
                        <Badge variant="secondary">Entrada</Badge>
                      ) : (
                        <Badge variant="destructive">Saída</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {movement.type === "ENTRADA" ? "+" : "-"}
                      {movement.quantity.toString()} {ingredient.unit}
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {movement.unitPriceAtEntry !== null
                        ? currency(Number(movement.unitPriceAtEntry))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-neutral-500">{movement.reason ?? "—"}</TableCell>
                    <TableCell className="text-neutral-500">{movement.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!hasRange && movements.length === HISTORY_LIMIT && (
            <p className="mt-2 text-xs text-neutral-500">
              Mostrando as {HISTORY_LIMIT} movimentações mais recentes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
