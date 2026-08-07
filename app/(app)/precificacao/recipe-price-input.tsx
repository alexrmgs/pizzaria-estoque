"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updateRecipeCurrentPrice } from "./actions";

export function RecipePriceInput({
  recipeId,
  initialPrice,
}: {
  recipeId: string;
  initialPrice: number | null;
}) {
  const [value, setValue] = useState(initialPrice !== null ? String(initialPrice) : "");
  const [isPending, startTransition] = useTransition();
  const lastSaved = useRef(initialPrice);

  function save() {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      toast.error("Preço inválido.");
      return;
    }
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    startTransition(async () => {
      await updateRecipeCurrentPrice(recipeId, next);
      toast.success("Preço atual salvo.");
    });
  }

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      placeholder="R$"
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      className="h-8 w-28"
    />
  );
}
