"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addTimeEntry, editTimeEntry } from "../funcionarios/[id]/actions";

type Entry = { id: string; clockIn: string; clockOut: string | null; note: string | null } | null;

export function EditPontoDialog({
  employeeId,
  employeeName,
  dateISO,
  entry,
}: {
  employeeId: string;
  employeeName: string;
  dateISO: string;
  entry: Entry;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = entry
        ? await editTimeEntry(employeeId, entry.id, undefined, formData)
        : await addTimeEntry(employeeId, undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button variant={entry ? "ghost" : "outline"} size="sm">
            {entry ? "Editar" : "Lançar"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar ponto" : "Lançar ponto"} — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={dateISO} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`ci-${employeeId}`}>Entrada</Label>
              <Input
                id={`ci-${employeeId}`}
                name="clockIn"
                type="time"
                defaultValue={entry?.clockIn ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`co-${employeeId}`}>Saída</Label>
              <Input
                id={`co-${employeeId}`}
                name="clockOut"
                type="time"
                defaultValue={entry?.clockOut ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`nt-${employeeId}`}>Observação</Label>
            <Input id={`nt-${employeeId}`} name="note" defaultValue={entry?.note ?? ""} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
