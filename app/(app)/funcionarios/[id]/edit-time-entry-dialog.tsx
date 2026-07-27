"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editTimeEntry } from "./actions";

type TimeEntry = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
};

export function EditTimeEntryDialog({
  employeeId,
  entry,
}: {
  employeeId: string;
  entry: TimeEntry;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await editTimeEntry(employeeId, entry.id, undefined, formData);
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
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar ponto</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-date-${entry.id}`}>Data</Label>
            <Input
              id={`edit-date-${entry.id}`}
              name="date"
              type="date"
              defaultValue={entry.date}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`edit-clockIn-${entry.id}`}>Entrada</Label>
              <Input
                id={`edit-clockIn-${entry.id}`}
                name="clockIn"
                type="time"
                defaultValue={entry.clockIn}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`edit-clockOut-${entry.id}`}>Saída</Label>
              <Input
                id={`edit-clockOut-${entry.id}`}
                name="clockOut"
                type="time"
                defaultValue={entry.clockOut ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-note-${entry.id}`}>Observação</Label>
            <Input id={`edit-note-${entry.id}`} name="note" defaultValue={entry.note ?? ""} />
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
