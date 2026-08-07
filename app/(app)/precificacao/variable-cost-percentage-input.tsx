"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updateVariableCostRate } from "./actions";

export function VariableCostPercentageInput({
  id,
  initialPercentage,
}: {
  id: string;
  initialPercentage: number;
}) {
  const [value, setValue] = useState(String(initialPercentage));
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialPercentage);

  function save() {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Percentual inválido.");
      return;
    }
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    startTransition(async () => {
      await updateVariableCostRate(id, next);
      toast.success("Custo variável atualizado.");
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        className="h-8 w-24"
      />
      <span className="text-neutral-500">%</span>
    </div>
  );
}
