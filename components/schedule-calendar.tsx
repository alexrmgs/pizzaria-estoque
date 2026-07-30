"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, STATUS_LABELS, type FolgaDate, type SwapRequest } from "@/lib/schedule";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const EMPLOYEE_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
];

export type RosterEmployee = {
  id: string;
  name: string;
  weeklyDayOff: number | null;
  folgas: FolgaDate[];
};

export function ScheduleCalendar({
  roster,
  myEmployeeId,
}: {
  roster: RosterEmployee[];
  myEmployeeId?: string;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const byDate = new Map<string, { id: string; name: string }[]>();
  for (const employee of roster) {
    for (const folga of employee.folgas) {
      const list = byDate.get(folga.date) ?? [];
      list.push({ id: employee.id, name: employee.name });
      byDate.set(folga.date, list);
    }
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const employeeColor = (id: string) => {
    const idx = roster.findIndex((e) => e.id === id);
    return EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
  };
  const todayISO = toISO(today);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setMonthOffset((m) => m - 1)}>
          ← Anterior
        </Button>
        <p className="text-sm font-medium">
          {MONTH_NAMES[month]} {year}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setMonthOffset((m) => m + 1)}>
          Próximo →
        </Button>
      </div>
      {/* Grade (telas médias pra cima) — em telas pequenas o texto fica cortado demais numa grade de 7 colunas */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
          {WEEKDAY_SHORT.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="rounded-lg" />;
            const iso = toISO(date);
            const offIds = new Set((byDate.get(iso) ?? []).map((p) => p.id));
            const isToday = iso === todayISO;
            const label = (employee: RosterEmployee) =>
              employee.id === myEmployeeId ? "Você" : employee.name.split(" ")[0];
            const off = roster.filter((e) => offIds.has(e.id));
            const working = roster.filter((e) => !offIds.has(e.id));
            return (
              <div
                key={i}
                className={cn("flex flex-col gap-1 rounded-lg border p-1", isToday && "border-primary")}
              >
                <span
                  className={cn("text-xs", isToday ? "font-semibold text-primary" : "text-neutral-400")}
                >
                  {date.getDate()}
                </span>
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-medium text-neutral-400">Folga</span>
                    {off.map((employee) => (
                      <span
                        key={employee.id}
                        className={cn(
                          "truncate rounded px-1 text-[10px] leading-tight",
                          employeeColor(employee.id),
                        )}
                      >
                        {label(employee)}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-medium text-neutral-400">Trab.</span>
                    {working.map((employee) => (
                      <span
                        key={employee.id}
                        className="truncate rounded px-1 text-[10px] leading-tight text-neutral-500"
                      >
                        {label(employee)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista (celular) — um bloco por dia, sem texto cortado */}
      <div className="flex flex-col gap-2 sm:hidden">
        {cells
          .filter((date): date is Date => date !== null)
          .map((date) => {
            const iso = toISO(date);
            const offIds = new Set((byDate.get(iso) ?? []).map((p) => p.id));
            const isToday = iso === todayISO;
            const label = (employee: RosterEmployee) =>
              employee.id === myEmployeeId ? "Você" : employee.name.split(" ")[0];
            const off = roster.filter((e) => offIds.has(e.id));
            const working = roster.filter((e) => !offIds.has(e.id));
            return (
              <div
                key={iso}
                className={cn("rounded-lg border p-2", isToday && "border-primary bg-primary/5")}
              >
                <p className={cn("text-sm font-medium", isToday && "text-primary")}>
                  {WEEKDAY_SHORT[date.getDay()]}, {date.getDate()}/{pad(date.getMonth() + 1)}
                </p>
                <div className="mt-1 flex flex-col gap-1 text-sm">
                  <p>
                    <span className="text-xs font-medium text-neutral-400">Folga: </span>
                    {off.length === 0 ? (
                      <span className="text-neutral-400">ninguém</span>
                    ) : (
                      off.map((employee) => (
                        <span
                          key={employee.id}
                          className={cn("mr-1 rounded px-1.5 py-0.5", employeeColor(employee.id))}
                        >
                          {label(employee)}
                        </span>
                      ))
                    )}
                  </p>
                  <p>
                    <span className="text-xs font-medium text-neutral-400">Trabalhando: </span>
                    <span className="text-neutral-600">
                      {working.map((employee) => label(employee)).join(", ") || "—"}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function ScheduleLegend({ roster, myEmployeeId }: { roster: RosterEmployee[]; myEmployeeId?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-neutral-400">Colorido = de folga nesse dia · cinza = trabalhando</p>
      <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
        {roster.map((employee, i) => (
          <span
            key={employee.id}
            className={cn("rounded px-1.5 py-0.5", EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length])}
          >
            {employee.id === myEmployeeId ? "Você" : employee.name.split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SwapRow({
  swap,
  otherName,
  action,
}: {
  swap: SwapRequest;
  otherName: string;
  action?: React.ReactNode;
}) {
  const status = STATUS_LABELS[swap.status] ?? { label: swap.status, variant: "outline" as const };
  return (
    <TableRow>
      <TableCell className="font-medium">{otherName}</TableCell>
      <TableCell className="text-neutral-500">{formatDate(swap.requesterDate)}</TableCell>
      <TableCell className="text-neutral-500">{formatDate(swap.targetDate)}</TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-right">{action}</TableCell>
    </TableRow>
  );
}
