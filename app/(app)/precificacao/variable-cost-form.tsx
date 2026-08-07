"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { upsertVariableCostRate } from "./actions";

const CATEGORY_SUGGESTIONS = ["Imposto", "Taxa de Máquina", "Entrega", "Lucro Desejado"];

export function VariableCostForm({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertVariableCostRate(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Custo variável salvo.");
        formRef.current?.reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cadastrar custo variável</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="storeId" value={storeId} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="category" className="text-xs">
              Categoria
            </Label>
            <Input
              id="category"
              name="category"
              list="variable-cost-categories"
              placeholder="Ex: Imposto"
              required
              className="h-9 w-48"
            />
            <datalist id="variable-cost-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="percentage" className="text-xs">
              Percentual (%)
            </Label>
            <Input
              id="percentage"
              name="percentage"
              type="number"
              step="0.01"
              min="0"
              required
              className="h-9 w-32"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
