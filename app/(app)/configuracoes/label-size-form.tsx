"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLabelSize } from "./actions";

export function LabelSizeForm({ width, height }: { width: number; height: number }) {
  const [w, setW] = useState(String(width));
  const [h, setH] = useState(String(height));
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateLabelSize(Number(w), Number(h));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Tamanho da etiqueta salvo.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="labelWidth" className="text-xs">
          Largura (mm)
        </Label>
        <Input
          id="labelWidth"
          type="number"
          min="20"
          max="200"
          value={w}
          onChange={(e) => setW(e.target.value)}
          className="h-9 w-24"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="labelHeight" className="text-xs">
          Altura (mm)
        </Label>
        <Input
          id="labelHeight"
          type="number"
          min="20"
          max="200"
          value={h}
          onChange={(e) => setH(e.target.value)}
          className="h-9 w-24"
        />
      </div>
      <Button size="sm" onClick={save} disabled={isPending}>
        Salvar
      </Button>
    </div>
  );
}
