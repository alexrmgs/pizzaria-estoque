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
import { WEEKDAY_NAMES, type FolgaDate } from "@/lib/schedule";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type RosterEmployee = { id: string; name: string; weeklyDayOff: number | null; folgas: FolgaDate[] };

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
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Folga fixa</TableHead>
                  <TableHead>Próximas folgas avulsas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((employee) => {
                  const avulsas = employee.folgas.filter((f) => f.source === "avulsa").slice(0, 3);
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.name}
                        {employee.id === myEmployeeId ? " (você)" : ""}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {employee.weeklyDayOff !== null ? WEEKDAY_NAMES[employee.weeklyDayOff] : "—"}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {avulsas.length > 0 ? avulsas.map((f) => formatDate(f.date)).join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
