import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { upcomingFolgas, formatDate, STATUS_LABELS } from "@/lib/schedule";
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

const DAYS_AHEAD = 60;

export default async function EscalasPage() {
  const user = await requirePermission("canManageFuncionarios");
  const myEmployee = await prisma.employee.findUnique({ where: { userId: user.id } });

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + DAYS_AHEAD);

  const [activeEmployees, windowDayOffs, pendingSwaps, recentSwaps] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, weeklyDayOff: true },
    }),
    prisma.dayOff.findMany({
      where: { date: { gte: windowStart, lte: windowEnd }, type: "FOLGA" },
      select: { employeeId: true, date: true },
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

  const avulsaByEmployee = new Map<string, Set<string>>();
  for (const dayOff of windowDayOffs) {
    const iso = dayOff.date.toISOString().slice(0, 10);
    const set = avulsaByEmployee.get(dayOff.employeeId) ?? new Set<string>();
    set.add(iso);
    avulsaByEmployee.set(dayOff.employeeId, set);
  }

  const roster = activeEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    weeklyDayOff: e.weeklyDayOff,
    folgas: upcomingFolgas(e.weeklyDayOff, avulsaByEmployee.get(e.id) ?? new Set(), DAYS_AHEAD, now),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Escalas</h1>
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
