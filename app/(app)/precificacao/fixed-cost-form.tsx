"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { upsertFixedCost } from "./actions";

const CATEGORY_SUGGESTIONS = ["Aluguel", "Água", "Energia", "Folha de Pagamento", "Internet", "Manutenção"];

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

export function FixedCostForm({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertFixedCost(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Custo fixo salvo.");
        formRef.current?.reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cadastrar custo fixo</CardTitle>
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
              list="fixed-cost-categories"
              placeholder="Ex: Aluguel"
              required
              className="h-9 w-48"
            />
            <datalist id="fixed-cost-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="referenceMonth" className="text-xs">
              Mês
            </Label>
            <Input
              id="referenceMonth"
              name="referenceMonth"
              type="month"
              defaultValue={currentMonthISO()}
              required
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="amount" className="text-xs">
              Valor (R$)
            </Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" required className="h-9 w-32" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="note" className="text-xs">
              Nota
            </Label>
            <Input id="note" name="note" placeholder="Opcional" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
