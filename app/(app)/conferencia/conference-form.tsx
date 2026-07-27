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
import { submitConference } from "./actions";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  categoryName: string | null;
};

export function ConferenceForm({ ingredients }: { ingredients: Ingredient[] }) {
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(ingredients.map((i) => [i.id, i.currentStock])),
  );
  const [isPending, startTransition] = useTransition();

  // Depois de salvar, a página revalida e o servidor manda o estoque já
  // atualizado (`ingredients` muda de referência) — resincroniza as caixas
  // de contagem com esse valor novo durante a renderização, senão elas
  // continuam mostrando o número antigo digitado mesmo já tendo sido salvo.
  const [syncedIngredients, setSyncedIngredients] = useState(ingredients);
  if (ingredients !== syncedIngredients) {
    setSyncedIngredients(ingredients);
    setCounts(Object.fromEntries(ingredients.map((i) => [i.id, i.currentStock])));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await submitConference(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result?.count
            ? `Conferência salva. ${result.count} item(ns) ajustado(s).`
            : "Nenhuma diferença encontrada.",
        );
      }
    });
  }

  const changedCount = ingredients.filter(
    (ingredient) => Number(counts[ingredient.id]) !== Number(ingredient.currentStock),
  ).length;

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Textarea
        name="note"
        placeholder="Observação (opcional) — ex: conferência mensal de junho"
        rows={2}
        className="max-w-md"
      />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Sistema</TableHead>
              <TableHead>Contagem</TableHead>
              <TableHead>Diferença</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500">
                  Nenhum ingrediente encontrado.
                </TableCell>
              </TableRow>
            )}
            {ingredients.map((ingredient) => {
              const counted = counts[ingredient.id] ?? "";
              const diff =
                counted === "" ? 0 : Number(counted) - Number(ingredient.currentStock);
              return (
                <TableRow key={ingredient.id}>
                  <TableCell className="font-medium">{ingredient.name}</TableCell>
                  <TableCell className="text-neutral-500">
                    {ingredient.categoryName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {ingredient.currentStock} {ingredient.unit}
                  </TableCell>
                  <TableCell>
                    <input type="hidden" name="ingredientId" value={ingredient.id} />
                    <input type="hidden" name="currentStock" value={ingredient.currentStock} />
                    <Input
                      name="countedQty"
                      type="number"
                      step="0.001"
                      min="0"
                      value={counted}
                      onChange={(event) =>
                        setCounts((prev) => ({ ...prev, [ingredient.id]: event.target.value }))
                      }
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    {diff === 0 ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <Badge variant={diff > 0 ? "secondary" : "destructive"}>
                        {diff > 0 ? "+" : ""}
                        {diff} {ingredient.unit}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div>
        <Button type="submit" disabled={isPending || changedCount === 0}>
          {isPending
            ? "Salvando..."
            : `Salvar conferência${changedCount > 0 ? ` (${changedCount} item${changedCount === 1 ? "" : "s"} alterado${changedCount === 1 ? "" : "s"})` : ""}`}
        </Button>
      </div>
    </form>
  );
}
