import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  formatShiftDuration,
  lateMinutes,
  nightHours,
  shiftHours,
  todayInBrazil,
  type AttendanceStreakTier,
} from "@/lib/payroll";
import { computePaymentPreview } from "@/lib/payment-preview";
import { getAppSettings } from "@/lib/settings";
import { upcomingFolgas } from "@/lib/schedule";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClockButton } from "./clock-button";
import { EscalaSection } from "./escala-section";

const DAYS_AHEAD = 60;

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function MeuPontoPage() {
  const user = await requireUser();

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    include: { store: true },
  });

  if (!employee) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold uppercase">Meu Ponto</h1>
        <p className="text-sm text-neutral-500">
          Sua conta ainda não está vinculada a um cadastro de funcionário. Peça para um
          administrador vincular em Configurações → Funcionários.
        </p>
      </div>
    );
  }

  const now = new Date();
  const brazilToday = todayInBrazil(now);
  const thirtyDaysAgo = new Date(
    Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), brazilToday.getUTCDate() - 30),
  );

  const lastPayment = await prisma.payment.findFirst({
    where: { employeeId: employee.id },
    orderBy: { periodEnd: "desc" },
  });

  const periodEnd = new Date(
    Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), brazilToday.getUTCDate(), 23, 59, 59),
  );
  let periodStart: Date;
  if (lastPayment) {
    periodStart = new Date(lastPayment.periodEnd.getTime() + 24 * 60 * 60 * 1000);
  } else if (employee.hireDate) {
    periodStart = new Date(employee.hireDate);
  } else {
    periodStart = new Date(
      Date.UTC(brazilToday.getUTCFullYear(), brazilToday.getUTCMonth(), brazilToday.getUTCDate() - 60),
    );
  }

  const [preview, settings] = await Promise.all([
    computePaymentPreview(employee.id, periodStart, periodEnd, user.companyId),
    getAppSettings(user.companyId),
  ]);
  const streakTiers = (settings.attendanceStreakTiers as unknown as AttendanceStreakTier[])
    .slice()
    .sort((a, b) => a.months - b.months);
  const nextStreakTier = streakTiers.find((t) => t.months > preview.attendanceStreakMonths);

  const [entries, advances, pastPayments] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { employeeId: employee.id, date: { gte: thirtyDaysAgo } },
      orderBy: { clockIn: "desc" },
      take: 30,
    }),
    prisma.advance.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { employeeId: employee.id },
      orderBy: { periodStart: "desc" },
      take: 12,
    }),
  ]);

  const openEntry = entries.find((entry) => !entry.clockOut);
  const pendingAdvancesTotal = advances
    .filter((a) => a.paymentId === null)
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const scheduleWindowStart = brazilToday;
  const scheduleWindowEnd = new Date(
    Date.UTC(
      brazilToday.getUTCFullYear(),
      brazilToday.getUTCMonth(),
      brazilToday.getUTCDate() + DAYS_AHEAD,
    ),
  );

  const [allActiveEmployees, windowDayOffs, sentSwaps, receivedSwaps] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weeklyDayOff: true },
    }),
    prisma.dayOff.findMany({
      where: {
        date: { gte: scheduleWindowStart, lte: scheduleWindowEnd },
        type: { in: ["FOLGA", "TRABALHA"] },
      },
      select: { employeeId: true, date: true, type: true },
    }),
    prisma.shiftSwapRequest.findMany({
      where: { requesterId: employee.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { target: { select: { name: true } } },
    }),
    prisma.shiftSwapRequest.findMany({
      where: { targetId: employee.id, status: "PENDENTE" },
      orderBy: { createdAt: "desc" },
      include: { requester: { select: { name: true } } },
    }),
  ]);

  const avulsaByEmployee = new Map<string, Set<string>>();
  const workOverrideByEmployee = new Map<string, Set<string>>();
  for (const dayOff of windowDayOffs) {
    const iso = dayOff.date.toISOString().slice(0, 10);
    const map = dayOff.type === "TRABALHA" ? workOverrideByEmployee : avulsaByEmployee;
    const set = map.get(dayOff.employeeId) ?? new Set<string>();
    set.add(iso);
    map.set(dayOff.employeeId, set);
  }

  const roster = allActiveEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    weeklyDayOff: e.weeklyDayOff,
    folgas: upcomingFolgas(
      e.weeklyDayOff,
      avulsaByEmployee.get(e.id) ?? new Set(),
      DAYS_AHEAD,
      now,
      workOverrideByEmployee.get(e.id) ?? new Set(),
    ),
  }));

  const sentSwapsData = sentSwaps.map((s) => ({
    id: s.id,
    requesterDate: s.requesterDate.toISOString().slice(0, 10),
    targetDate: s.targetDate.toISOString().slice(0, 10),
    status: s.status,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    targetName: s.target.name,
  }));

  const receivedSwapsData = receivedSwaps.map((s) => ({
    id: s.id,
    requesterDate: s.requesterDate.toISOString().slice(0, 10),
    targetDate: s.targetDate.toISOString().slice(0, 10),
    status: s.status,
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    requesterName: s.requester.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {employee.name.split(" ")[0]}</h1>
        <p className="text-sm text-neutral-500">
          Bata seu ponto e acompanhe seu desempenho e seu salário aqui.
        </p>
      </div>

      <Tabs defaultValue="ponto">
        <TabsList>
          <TabsTrigger value="ponto">Ponto</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="escala">Escala</TabsTrigger>
          <TabsTrigger value="salario">Salário e Vales</TabsTrigger>
        </TabsList>

        <TabsContent value="ponto" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8">
              {openEntry ? (
                <p className="text-sm text-neutral-500">
                  Trabalhando desde{" "}
                  <span className="font-medium text-foreground">
                    {openEntry.clockIn.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-neutral-500">Você não está com ponto aberto agora.</p>
              )}
              {employee.store && (
                <p className="text-xs text-neutral-400">
                  Bata o ponto perto de &quot;{employee.store.name}&quot; (
                  {employee.store.radiusMeters}m de raio)
                </p>
              )}
              {settings.pontoMode === "FACIAL" ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  📷 O ponto agora é por reconhecimento facial, no aparelho da loja. Não precisa bater
                  pelo celular.
                </p>
              ) : (
                <ClockButton isOpen={!!openEntry} hasStore={!!employee.store} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Últimos registros de ponto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Atraso</TableHead>
                      <TableHead>Local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-neutral-500">
                          Nenhum registro ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {entries.map((entry) => {
                      const late = lateMinutes(employee.scheduledStart, entry.clockIn);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.date.toISOString().slice(0, 10)}</TableCell>
                          <TableCell>
                            {entry.clockIn.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            {entry.clockOut
                              ? entry.clockOut.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {entry.clockOut
                              ? formatShiftDuration(shiftHours(entry.clockIn, entry.clockOut))
                              : "—"}
                            {entry.clockOut && nightHours(entry.clockIn, entry.clockOut) > 0 && (
                              <span className="text-neutral-500">
                                {" "}
                                ({formatShiftDuration(nightHours(entry.clockIn, entry.clockOut))} noturnas)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {late > 0 ? <Badge variant="destructive">{late} min</Badge> : "—"}
                          </TableCell>
                          <TableCell className="text-neutral-500">
                            {entry.clockInDistanceM !== null ? `${entry.clockInDistanceM}m` : "—"}
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

        <TabsContent value="desempenho" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Sua pontuação este mês
                <span className="text-sm font-normal text-neutral-500">
                  (desde {periodStart.toLocaleDateString("pt-BR")})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Pontualidade</p>
                  <p className="text-lg font-semibold">{preview.attendanceScore}/100</p>
                  {preview.lateOccurrences > 0 && (
                    <p className="text-xs text-neutral-500">
                      {preview.lateOccurrences} atraso{preview.lateOccurrences === 1 ? "" : "s"} além
                      da tolerância
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Faltas/atestados no período</p>
                  <p className="text-lg font-semibold">{preview.absenceCount}</p>
                  {preview.absenceCount > 0 && (
                    <p className="text-xs text-destructive">Zera o bônus e a sequência</p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Sequência sem zerar</p>
                  <p className="text-lg font-semibold">
                    {preview.attendanceStreakMonths} mês
                    {preview.attendanceStreakMonths === 1 ? "" : "es"}
                  </p>
                  {preview.attendanceStreakMultiplier > 1 ? (
                    <p className="text-xs text-primary">
                      Bônus multiplicado por {preview.attendanceStreakMultiplier}x
                    </p>
                  ) : nextStreakTier ? (
                    <p className="text-xs text-neutral-500">
                      Faltam {nextStreakTier.months - preview.attendanceStreakMonths} mês
                      {nextStreakTier.months - preview.attendanceStreakMonths === 1 ? "" : "es"} pra
                      bônus x{nextStreakTier.multiplier}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Bônus estimado</p>
                  <p className="text-lg font-semibold text-primary">
                    {currency(preview.attendanceBonusAmount)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Valores estimados com base no que já foi batido no ponto neste período — o valor
                final é confirmado quando o pagamento fecha, junto com o resto do seu salário.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de meses fechados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Pontualidade</TableHead>
                      <TableHead>Sequência</TableHead>
                      <TableHead>Bônus recebido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastPayments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-neutral-500">
                          Nenhum mês fechado ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {pastPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-neutral-500">
                          {payment.periodStart.toISOString().slice(0, 10)} a{" "}
                          {payment.periodEnd.toISOString().slice(0, 10)}
                        </TableCell>
                        <TableCell>{payment.attendanceScore}/100</TableCell>
                        <TableCell>
                          {payment.attendanceStreakMonths} mês
                          {payment.attendanceStreakMonths === 1 ? "" : "es"}
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {currency(Number(payment.attendanceBonusAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escala" className="pt-4">
          <EscalaSection
            myEmployeeId={employee.id}
            roster={roster}
            sentSwaps={sentSwapsData}
            receivedSwaps={receivedSwapsData}
          />
        </TabsContent>

        <TabsContent value="salario" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Meus ganhos
                <span className="text-sm font-normal text-neutral-500">
                  (período: {periodStart.toLocaleDateString("pt-BR")} a{" "}
                  {periodEnd.toLocaleDateString("pt-BR")}
                  {lastPayment ? ", desde o último pagamento" : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Salário base</p>
                  <p className="text-lg font-semibold">{currency(preview.baseSalary)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">
                    Adicional noturno ({preview.totalNightHours.toFixed(2)}h)
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {currency(preview.nightPremium)}
                  </p>
                </div>
                {preview.overtimeMode === "HORA_EXTRA" ? (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-neutral-500">
                      Hora extra ({preview.overtimeHours.toFixed(2)}h)
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {currency(preview.overtimeAmount)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-neutral-500">Banco de horas</p>
                    <p className="text-lg font-semibold">{preview.bankedHours.toFixed(2)}h</p>
                  </div>
                )}
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Líquido previsto</p>
                  <p className="text-lg font-semibold text-primary">
                    {currency(preview.netAmount - preview.faltaAmountAuto)}
                  </p>
                </div>
              </div>

              {preview.lateDiscountAmount > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">
                    Desconto por atraso: {currency(preview.lateDiscountAmount)} (
                    {preview.lateDiscountMinutes} de {preview.lateMinutesTotal} min de atraso no
                    período)
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    A tolerância legal é de até 5 minutos por evento — acima disso, o atraso todo
                    entra no desconto.
                  </p>
                </div>
              )}

              {preview.faltaDaysAuto > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">
                    Desconto por falta: {currency(preview.faltaAmountAuto)} — faltou em{" "}
                    {preview.faltaDatesAuto.map((d) => d.split("-").reverse().join("/")).join(", ")}
                    {preview.faltaDsrDaysAuto > 0 &&
                      `, e perdeu o descanso semanal remunerado (DSR) da${
                        preview.faltaDsrDaysAuto === 1 ? "" : "s"
                      } semana${preview.faltaDsrDaysAuto === 1 ? "" : "s"}`}
                    {preview.faltaHolidayDaysAuto > 0 &&
                      ` e o pagamento de ${preview.faltaHolidayDaysAuto} feriado${
                        preview.faltaHolidayDaysAuto === 1 ? "" : "s"
                      } na mesma semana`}
                    {" "}({preview.faltaDaysAuto} dia{preview.faltaDaysAuto === 1 ? "" : "s"} no
                    total).
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Falta sem justificativa desconta o dia, o descanso semanal remunerado da semana
                    e eventual feriado na mesma semana (1/30 do salário cada), como manda a Lei
                    605/49.
                  </p>
                  {preview.faltaDsrDaysAuto === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Sem folga fixa semanal cadastrada, não dá pra calcular o DSR perdido — só o
                      dia da falta está contando aqui. Peça pra um administrador cadastrar sua folga
                      fixa.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-neutral-500">
                    Bônus ({currency(preview.bonusTotal)})
                  </p>
                  {preview.bonusItems.length === 0 ? (
                    <p className="text-sm text-neutral-400">Nenhum bônus no período.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-sm">
                      {preview.bonusItems.map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span className="text-neutral-500">
                            {item.date} {item.description ? `· ${item.description}` : ""}
                          </span>
                          <span className="font-medium text-primary">
                            {currency(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-neutral-500">
                    Descontos ({currency(preview.discountTotal)})
                  </p>
                  {preview.discountItems.length === 0 ? (
                    <p className="text-sm text-neutral-400">Nenhum desconto no período.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-sm">
                      {preview.discountItems.map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span className="text-neutral-500">
                            {item.date} {item.description ? `· ${item.description}` : ""}
                          </span>
                          <span className="font-medium text-destructive">
                            -{currency(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className="text-xs text-neutral-400">
                Vales pendentes descontam do próximo pagamento — veja o detalhamento em &quot;Meus
                vales&quot; abaixo. Total pendente: {currency(preview.advancesTotal)}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Meus vales
                <span className="text-sm font-normal text-neutral-500">
                  (pendente: {currency(pendingAdvancesTotal)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-neutral-500">
                          Nenhum vale lançado ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {advances.map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell>{advance.date.toISOString().slice(0, 10)}</TableCell>
                        <TableCell>{currency(Number(advance.amount))}</TableCell>
                        <TableCell className="text-neutral-500">
                          {advance.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          {advance.paymentId ? (
                            <Badge variant="secondary">Pago</Badge>
                          ) : (
                            <Badge variant="destructive">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
