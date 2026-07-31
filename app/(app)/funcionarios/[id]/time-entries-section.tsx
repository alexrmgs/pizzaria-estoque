"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { addTimeEntry, deleteTimeEntry } from "./actions";
import { EditTimeEntryDialog } from "./edit-time-entry-dialog";
import { formatShiftDuration } from "@/lib/payroll";

type TimeEntry = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  nightHours: number;
  lateMinutes: number;
  clockInDistanceM: number | null;
  clockOutDistanceM: number | null;
  note: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TimeEntriesSection({
  employeeId,
  entries,
}: {
  employeeId: string;
  entries: TimeEntry[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addTimeEntry(employeeId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Ponto registrado.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTimeEntry(employeeId, id);
      toast.success("Registro removido.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ponto</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="date" className="text-xs">
              Data
            </Label>
            <Input id="date" name="date" type="date" defaultValue={todayISO()} required className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="clockIn" className="text-xs">
              Entrada
            </Label>
            <Input id="clockIn" name="clockIn" type="time" required className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="clockOut" className="text-xs">
              Saída
            </Label>
            <Input id="clockOut" name="clockOut" type="time" className="h-9" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="note" className="text-xs">
              Observação
            </Label>
            <Input id="note" name="note" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Registrar
          </Button>
        </form>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Noturnas</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">
                    Nenhum registro de ponto ainda.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>{entry.clockIn}</TableCell>
                  <TableCell>{entry.clockOut ?? "—"}</TableCell>
                  <TableCell>
                    {entry.hours !== null ? formatShiftDuration(entry.hours) : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.nightHours > 0 ? formatShiftDuration(entry.nightHours) : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.lateMinutes > 0 ? (
                      <Badge variant="destructive">{entry.lateMinutes} min</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {entry.clockInDistanceM !== null ? `${entry.clockInDistanceM}m` : "—"}
                    {entry.clockOutDistanceM !== null ? ` / ${entry.clockOutDistanceM}m` : ""}
                  </TableCell>
                  <TableCell className="text-neutral-500">{entry.note ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EditTimeEntryDialog
                        employeeId={employeeId}
                        entry={{
                          id: entry.id,
                          date: entry.date,
                          clockIn: entry.clockIn,
                          clockOut: entry.clockOut,
                          note: entry.note,
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          if (confirm("Excluir este registro de ponto?")) handleDelete(entry.id);
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
