"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { submitProduction } from "./actions";

type Item = {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  categoryName: string | null;
  belowMin: boolean;
  suggestion: number;
};

export function ProductionForm({ items }: { items: Item[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await submitProduction(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result?.count
            ? `${result.count} item(ns) registrado(s) na produção.`
            : "Nenhuma quantidade informada.",
        );
        setValues({});
      }
    });
  }

  const filledCount = Object.values(values).filter((value) => Number(value) > 0).length;

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Textarea
        name="note"
        placeholder="Observação (opcional) — ex: turno da manhã"
        rows={2}
        className="max-w-md"
      />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Estoque atual</TableHead>
              <TableHead>Sugestão de produção</TableHead>
              <TableHead>Produzido hoje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500">
                  Nenhum item marcado como &quot;produzido internamente&quot; ainda. Marque isso
                  na tela de Estoque, na edição do ingrediente.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => {
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-neutral-500">{item.categoryName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>
                        {item.currentStock} {item.unit}
                      </span>
                      {item.belowMin && <Badge variant="destructive">Baixo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className={item.suggestion > 0 ? "font-medium text-primary" : "text-neutral-500"}>
                    {item.suggestion > 0 ? `${item.suggestion} ${item.unit}` : "—"}
                  </TableCell>
                  <TableCell>
                    <input type="hidden" name="ingredientId" value={item.id} />
                    <Input
                      name="quantity"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0"
                      value={values[item.id] ?? ""}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      className="w-28"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {items.length > 0 && (
        <div>
          <Button type="submit" disabled={isPending || filledCount === 0}>
            {isPending
              ? "Salvando..."
              : `Registrar produção${filledCount > 0 ? ` (${filledCount} item${filledCount === 1 ? "" : "s"})` : ""}`}
          </Button>
        </div>
      )}
    </form>
  );
}
