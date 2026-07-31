"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createMovementsBatch } from "./actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Ingredient = { id: string; name: string; unit: string };

type PendingItem = {
  key: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  reason?: string;
  unitPrice?: number;
};

export function MovementForm({
  ingredients,
  type,
}: {
  ingredients: Ingredient[];
  type: "ENTRADA" | "SAIDA";
}) {
  const [isPending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const [items, setItems] = useState<PendingItem[]>([]);

  const isEntrada = type === "ENTRADA";
  const ingredientItems = ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));

  function handleAddItem(formData: FormData) {
    const ingredientId = String(formData.get("ingredientId") ?? "");
    const quantity = Number(formData.get("quantity"));
    const reason = String(formData.get("reason") ?? "").trim() || undefined;
    const unitPriceRaw = String(formData.get("unitPrice") ?? "").trim();
    const unitPrice = isEntrada && unitPriceRaw !== "" ? Number(unitPriceRaw) : undefined;

    const ingredient = ingredientById.get(ingredientId);
    if (!ingredient) {
      toast.error("Selecione um ingrediente.");
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    if (unitPrice !== undefined && unitPrice <= 0) {
      toast.error("O preço de compra deve ser maior que zero.");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        key: `${ingredientId}-${Date.now()}-${Math.random()}`,
        ingredientId,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        quantity,
        reason,
        unitPrice,
      },
    ]);
    setFormKey((k) => k + 1);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await createMovementsBatch(
        type,
        items.map(({ ingredientId, quantity, reason, unitPrice }) => ({
          ingredientId,
          quantity,
          reason,
          unitPrice,
        })),
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${result?.count ?? items.length} ${isEntrada ? "entrada(s)" : "saída(s)"} efetivada(s) com sucesso.`,
        );
        setItems([]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Adicionar {isEntrada ? "entrada" : "saída"} à lista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form key={formKey} action={handleAddItem} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`ingredientId-${type}`}>Ingrediente</Label>
              <Combobox items={ingredientItems} name="ingredientId" required>
                <ComboboxInput
                  id={`ingredientId-${type}`}
                  placeholder="Buscar ingrediente..."
                  autoComplete="off"
                />
                <ComboboxContent>
                  <ComboboxEmpty>Nenhum ingrediente encontrado.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: { value: string; label: string }) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`quantity-${type}`}>Quantidade</Label>
              <Input
                id={`quantity-${type}`}
                name="quantity"
                type="number"
                step="0.001"
                min="0"
                required
              />
            </div>

            {isEntrada && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`unitPrice-${type}`}>Preço de compra dessa vez (opcional)</Label>
                <Input
                  id={`unitPrice-${type}`}
                  name="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Deixe em branco pra manter o preço já cadastrado"
                />
                <p className="text-xs text-neutral-500">
                  Se preencher, o preço cadastrado é recalculado como média ponderada entre o
                  estoque que já existe e essa compra — não sobrescreve direto.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor={`reason-${type}`}>Motivo (opcional)</Label>
              <Textarea
                id={`reason-${type}`}
                name="reason"
                placeholder={isEntrada ? "Ex: compra, produção..." : "Ex: perda, ajuste, uso..."}
              />
            </div>

            <Button type="submit" variant="outline">
              + Adicionar à lista
            </Button>
          </form>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Conferência ({items.length} {items.length === 1 ? "item" : "itens"})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Quantidade</TableHead>
                    {isEntrada && <TableHead>Preço de compra</TableHead>}
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-medium">{item.ingredientName}</TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      {isEntrada && (
                        <TableCell className="text-neutral-500">
                          {item.unitPrice !== undefined ? currency(item.unitPrice) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-neutral-500">{item.reason ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.key)}>
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={isEntrada ? "default" : "destructive"}
            >
              {isPending
                ? "Efetivando..."
                : `Efetivar ${items.length} ${isEntrada ? "entrada(s)" : "saída(s)"}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
