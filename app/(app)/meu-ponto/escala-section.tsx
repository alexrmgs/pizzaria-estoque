"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requestSwap, respondToSwapAsEmployee, cancelSwapRequest } from "./swap-actions";
import type { FolgaDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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

const EMPLOYEE_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
];

type RosterEmployee = { id: string; name: string; weeklyDayOff: number | null; folgas: FolgaDate[] };

function ScheduleCalendar({
  roster,
  myEmployeeId,
}: {
  roster: RosterEmployee[];
  myEmployeeId: string;
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
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-24 rounded-lg" />;
          const iso = toISO(date);
          const offIds = new Set((byDate.get(iso) ?? []).map((p) => p.id));
          const isToday = iso === todayISO;
          return (
            <div
              key={i}
              className={cn(
                "flex min-h-24 flex-col gap-0.5 rounded-lg border p-1",
                isToday && "border-primary",
              )}
            >
              <span
                className={cn("text-xs", isToday ? "font-semibold text-primary" : "text-neutral-400")}
              >
                {date.getDate()}
              </span>
              {roster.map((employee) => {
                const isOff = offIds.has(employee.id);
                const label = employee.id === myEmployeeId ? "Você" : employee.name.split(" ")[0];
                return (
                  <span
                    key={employee.id}
                    className={cn(
                      "truncate rounded px-1 text-[10px] leading-tight",
                      isOff ? employeeColor(employee.id) : "text-neutral-400",
                    )}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SwapRequest = {
  id: string;
  requesterDate: string;
  targetDate: string;
  status: string;
  note: string | null;
  createdAt: string;
  requesterName?: string;
  targetName?: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "destructive" | "outline" }> = {
  PENDENTE: { label: "Aguardando colega", variant: "outline" },
  ACEITO_PELO_FUNCIONARIO: { label: "Aguardando gerência", variant: "outline" },
  RECUSADO_PELO_FUNCIONARIO: { label: "Recusado pelo colega", variant: "destructive" },
  APROVADO: { label: "Aprovado", variant: "secondary" },
  RECUSADO_PELA_GERENCIA: { label: "Recusado pela gerência", variant: "destructive" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};

function RequestSwapForm({
  myEmployeeId,
  roster,
}: {
  myEmployeeId: string;
  roster: RosterEmployee[];
}) {
  const [isPending, startTransition] = useTransition();
  const me = roster.find((e) => e.id === myEmployeeId);
  const colleagues = roster.filter((e) => e.id !== myEmployeeId);
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [requesterDate, setRequesterDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [note, setNote] = useState("");
  const target = colleagues.find((e) => e.id === targetEmployeeId);

  function reset() {
    setTargetEmployeeId("");
    setRequesterDate("");
    setTargetDate("");
    setNote("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Solicitar troca de folga</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Colega</Label>
          <Select
            value={targetEmployeeId || undefined}
            onValueChange={(value) => {
              setTargetEmployeeId(value ?? "");
              setTargetDate("");
            }}
            items={colleagues.map((c) => ({ value: c.id, label: c.name }))}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Escolha o colega" />
            </SelectTrigger>
            <SelectContent>
              {colleagues.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Sua folga (você dá essa)</Label>
          <Select
            value={requesterDate || undefined}
            onValueChange={(value) => setRequesterDate(value ?? "")}
            items={(me?.folgas ?? []).map((f) => ({ value: f.date, label: formatDate(f.date) }))}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Sua data" />
            </SelectTrigger>
            <SelectContent>
              {(me?.folgas ?? []).map((f) => (
                <SelectItem key={f.date} value={f.date}>
                  {formatDate(f.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Folga do colega (você assume essa)</Label>
          <Select
            value={targetDate || undefined}
            onValueChange={(value) => setTargetDate(value ?? "")}
            disabled={!target}
            items={(target?.folgas ?? []).map((f) => ({ value: f.date, label: formatDate(f.date) }))}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={target ? "Data do colega" : "Escolha o colega primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {(target?.folgas ?? []).map((f) => (
                <SelectItem key={f.date} value={f.date}>
                  {formatDate(f.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Mensagem (opcional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: preciso ir num compromisso" />
      </div>
      <Button
        type="button"
        size="sm"
        className="w-fit"
        disabled={isPending || !targetEmployeeId || !requesterDate || !targetDate}
        onClick={() => {
          const formData = new FormData();
          formData.set("targetEmployeeId", targetEmployeeId);
          formData.set("requesterDate", requesterDate);
          formData.set("targetDate", targetDate);
          if (note) formData.set("note", note);
          startTransition(async () => {
            const result = await requestSwap(undefined, formData);
            if (result?.error) {
              toast.error(result.error);
            } else {
              toast.success("Solicitação enviada! Assim que o colega aceitar, vai pra aprovação da gerência.");
              reset();
            }
          });
        }}
      >
        {isPending ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </div>
  );
}

function SwapRow({
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

export function EscalaSection({
  myEmployeeId,
  roster,
  sentSwaps,
  receivedSwaps,
}: {
  myEmployeeId: string;
  roster: RosterEmployee[];
  sentSwaps: SwapRequest[];
  receivedSwaps: SwapRequest[];
}) {
  const [isPending, startTransition] = useTransition();

  function respond(swapId: string, accept: boolean) {
    startTransition(async () => {
      try {
        await respondToSwapAsEmployee(swapId, accept);
        toast.success(accept ? "Troca aceita! Agora aguarda aprovação da gerência." : "Troca recusada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível responder.");
      }
    });
  }

  function cancel(swapId: string) {
    startTransition(async () => {
      try {
        await cancelSwapRequest(swapId);
        toast.success("Solicitação cancelada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível cancelar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {receivedSwaps.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Pedidos de troca pra você</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {receivedSwaps.map((swap) => (
              <div key={swap.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
                <p className="text-sm">
                  <span className="font-medium">{swap.requesterName}</span> quer dar a folga de{" "}
                  <span className="font-medium">{formatDate(swap.requesterDate)}</span> e assumir sua
                  folga de <span className="font-medium">{formatDate(swap.targetDate)}</span>
                  {swap.note ? <span className="text-neutral-500"> — &quot;{swap.note}&quot;</span> : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={() => respond(swap.id, true)}>
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => respond(swap.id, false)}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Escala da equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ScheduleCalendar roster={roster} myEmployeeId={myEmployeeId} />

          <div className="flex flex-col gap-1">
            <p className="text-xs text-neutral-400">
              Colorido = de folga nesse dia · cinza = trabalhando
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
              {roster.map((employee, i) => (
                <span
                  key={employee.id}
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length],
                  )}
                >
                  {employee.id === myEmployeeId ? "Você" : employee.name.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>

          <RequestSwapForm myEmployeeId={myEmployeeId} roster={roster} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Minhas solicitações de troca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colega</TableHead>
                  <TableHead>Sua folga</TableHead>
                  <TableHead>Folga do colega</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sentSwaps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhuma solicitação enviada ainda.
                    </TableCell>
                  </TableRow>
                )}
                {sentSwaps.map((swap) => (
                  <SwapRow
                    key={swap.id}
                    swap={swap}
                    otherName={swap.targetName ?? ""}
                    action={
                      swap.status === "PENDENTE" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => cancel(swap.id)}
                        >
                          Cancelar
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
