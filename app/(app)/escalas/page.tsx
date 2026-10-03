import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { upcomingFolgas, formatDate, STATUS_LABELS } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/payroll";
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
import { ScheduleCalendar, ScheduleLegend } from "@/components/schedule-calendar";
import { SwapApprovalButtons } from "../funcionarios/swap-approval-buttons";
import {
  addWeeksISO,
  CICLO_SEMANAS,
  domingosISO,
  proximoDomingoISO,
  RODIZIO_REASON,
} from "@/lib/rodizio-domingos";
import { RodizioDomingos } from "./rodizio-domingos";
import { FOLGA_COMPRADA_REASON } from "@/lib/folga-comprada";

const DAYS_AHEAD = 60;

export default async function EscalasPage() {
  const user = await requirePermission("canManageFuncionarios");
  const myEmployee = await prisma.employee.findUnique({ where: { userId: user.id } });

  const now = new Date();
  const windowStart = todayInBrazil(now);
  const windowEnd = new Date(
    Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate() + DAYS_AHEAD),
  );

  const [activeEmployees, windowDayOffs, pendingSwaps, recentSwaps] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weeklyDayOff: true },
    }),
    prisma.dayOff.findMany({
      where: {
        date: { gte: windowStart, lte: windowEnd },
        type: { in: ["FOLGA", "TRABALHA"] },
      },
      select: { employeeId: true, date: true, type: true },
    }),
    prisma.shiftSwapRequest.findMany({
      where: { status: "ACEITO_PELO_FUNCIONARIO" },
      orderBy: { targetRespondedAt: "asc" },
      include: { requester: { select: { name: true } }, target: { select: { name: true } } },
    }),
    prisma.shiftSwapRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { requester: { select: { name: true } }, target: { select: { name: true } } },
    }),
  ]);

  // Quadro do rodízio de domingos: 2 domingos pra trás e 16 pra frente.
  const domingos = domingosISO(addWeeksISO(proximoDomingoISO(now), -2), 18);
  const [folgasDomingo, rodizioCount] = await Promise.all([
    prisma.dayOff.findMany({
      where: {
        date: { in: domingos.map((d) => new Date(`${d}T00:00:00Z`)) },
        OR: [{ type: "FOLGA" }, { type: "TRABALHA", reason: { startsWith: FOLGA_COMPRADA_REASON } }],
      },
      select: { employeeId: true, date: true, type: true },
    }),
    prisma.dayOff.count({ where: { reason: RODIZIO_REASON } }),
  ]);
  const rodizioLinhas = activeEmployees
    .filter((e) => e.weeklyDayOff !== 0)
    .map((e) => ({
      id: e.id,
      name: e.name,
      folgas: folgasDomingo
        .filter((f) => f.employeeId === e.id && f.type === "FOLGA")
        .map((f) => f.date.toISOString().slice(0, 10)),
      compradas: folgasDomingo
        .filter((f) => f.employeeId === e.id && f.type === "TRABALHA")
        .map((f) => f.date.toISOString().slice(0, 10)),
    }));

  const avulsaByEmployee = new Map<string, Set<string>>();
  const workOverrideByEmployee = new Map<string, Set<string>>();
  for (const dayOff of windowDayOffs) {
    const iso = dayOff.date.toISOString().slice(0, 10);
    const map = dayOff.type === "TRABALHA" ? workOverrideByEmployee : avulsaByEmployee;
    const set = map.get(dayOff.employeeId) ?? new Set<string>();
    set.add(iso);
    map.set(dayOff.employeeId, set);
  }

  const roster = activeEmployees.map((e) => ({
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Escalas</h1>
        <p className="text-sm text-neutral-500">
          Calendário de folgas da equipe e aprovação de trocas entre funcionários.
        </p>
      </div>

      {pendingSwaps.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Trocas de folga aguardando aprovação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingSwaps.map((swap) => (
              <div
                key={swap.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3"
              >
                <p className="text-sm">
                  <span className="font-medium">{swap.requester.name}</span> dá a folga de{" "}
                  <span className="font-medium">
                    {formatDate(swap.requesterDate.toISOString().slice(0, 10))}
                  </span>{" "}
                  e assume a folga de <span className="font-medium">{swap.target.name}</span> em{" "}
                  <span className="font-medium">
                    {formatDate(swap.targetDate.toISOString().slice(0, 10))}
                  </span>
                  {swap.note ? <span className="text-neutral-500"> — &quot;{swap.note}&quot;</span> : ""}
                </p>
                <SwapApprovalButtons swapId={swap.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rodízio de domingos</CardTitle>
        </CardHeader>
        <CardContent>
          <RodizioDomingos
            domingos={domingos}
            linhas={rodizioLinhas}
            todayISO={windowStart.toISOString().slice(0, 10)}
            temRodizio={rodizioCount > 0}
            ciclo={CICLO_SEMANAS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calendário da equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ScheduleCalendar roster={roster} myEmployeeId={myEmployee?.id} />
          <ScheduleLegend roster={roster} myEmployeeId={myEmployee?.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de trocas de folga</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Data dada</TableHead>
                  <TableHead>Data assumida</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSwaps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhuma troca solicitada ainda.
                    </TableCell>
                  </TableRow>
                )}
                {recentSwaps.map((swap) => {
                  const status = STATUS_LABELS[swap.status] ?? {
                    label: swap.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={swap.id}>
                      <TableCell className="font-medium">{swap.requester.name}</TableCell>
                      <TableCell className="font-medium">{swap.target.name}</TableCell>
                      <TableCell className="text-neutral-500">
                        {formatDate(swap.requesterDate.toISOString().slice(0, 10))}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {formatDate(swap.targetDate.toISOString().slice(0, 10))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
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
