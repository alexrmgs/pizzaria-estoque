"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { updateFixedCost } from "./actions";

export function FixedCostEditableCells({
  id,
  initialAmount,
  initialNote,
}: {
  id: string;
  initialAmount: number;
  initialNote: string | null;
}) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [note, setNote] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef({ amount: initialAmount, note: initialNote ?? "" });

  function save() {
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (nextAmount === lastSaved.current.amount && note === lastSaved.current.note) return;
    lastSaved.current = { amount: nextAmount, note };
    startTransition(async () => {
      await updateFixedCost(id, nextAmount, note.trim() || null);
      toast.success("Custo fixo atualizado.");
    });
  }

  return (
    <>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          disabled={isPending}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={save}
          className="h-8 w-28"
        />
      </TableCell>
      <TableCell>
        <Input
          value={note}
          disabled={isPending}
          placeholder="Opcional"
          onChange={(e) => setNote(e.target.value)}
          onBlur={save}
          className="h-8"
        />
      </TableCell>
    </>
  );
}
