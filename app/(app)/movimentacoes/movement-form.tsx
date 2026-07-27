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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createMovement } from "./actions";

type Ingredient = { id: string; name: string; unit: string };

export function MovementForm({ ingredients }: { ingredients: Ingredient[] }) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Registrar movimentação</CardTitle>
      </CardHeader>
      <CardContent>
        <form key={resetKey} action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ingredientId">Ingrediente</Label>
            <Combobox items={ingredientItems} name="ingredientId" required>
              <ComboboxInput
                id="ingredientId"
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
            <Label htmlFor="type">Tipo</Label>
            <Select
              name="type"
              autoComplete="off"
              required
              defaultValue="ENTRADA"
              items={[
                { value: "ENTRADA", label: "Entrada" },
                { value: "SAIDA", label: "Saída" },
              ]}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantidade</Label>
            <Input id="quantity" name="quantity" type="number" step="0.001" min="0" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea id="reason" name="reason" placeholder="Ex: compra, perda, ajuste..." />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Registrando..." : "Registrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
