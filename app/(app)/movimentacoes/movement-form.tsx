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
import { createMovement } from "./actions";

type Ingredient = { id: string; name: string; unit: string };

export function MovementForm({
  ingredients,
  type,
}: {
  ingredients: Ingredient[];
  type: "ENTRADA" | "SAIDA";
}) {
  const [isPending, startTransition] = useTransition();
  const [resetKey, setResetKey] = useState(0);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMovement(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Movimentação registrada com sucesso.");
        setResetKey((key) => key + 1);
      }
    });
  }

  const ingredientItems = ingredients.map((ingredient) => ({
    value: ingredient.id,
    label: `${ingredient.name} (${ingredient.unit})`,
  }));

  const isEntrada = type === "ENTRADA";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Registrar {isEntrada ? "entrada" : "saída"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form key={resetKey} action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value={type} />

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

          <div className="flex flex-col gap-2">
            <Label htmlFor={`reason-${type}`}>Motivo (opcional)</Label>
            <Textarea
              id={`reason-${type}`}
              name="reason"
              placeholder={isEntrada ? "Ex: compra, produção..." : "Ex: perda, ajuste, uso..."}
            />
          </div>

          <Button type="submit" disabled={isPending} variant={isEntrada ? "default" : "destructive"}>
            {isPending ? "Registrando..." : `Registrar ${isEntrada ? "entrada" : "saída"}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
