"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRecipe, updateRecipe } from "./actions";
import { X } from "lucide-react";

type Ingredient = { id: string; name: string; unit: string };

type RecipeType = "PRODUCAO" | "PIZZA" | "BEIRUTE" | "ESFIHA";

const RECIPE_TYPES: { value: RecipeType; label: string }[] = [
  { value: "PRODUCAO", label: "Produção (massa, molho, carnes...)" },
  { value: "PIZZA", label: "Ficha de Pizza" },
  { value: "BEIRUTE", label: "Ficha de Beirute" },
  { value: "ESFIHA", label: "Ficha de Esfiha" },
];

type RecipeIngredientRow = {
  key: string;
  ingredientId: string;
  quantity: string;
  wastePercent: string;
};

type Recipe = {
  id: string;
  name: string;
  type: RecipeType;
  description: string | null;
  instructions: string | null;
  yieldKg: string | null;
  ingredients: { ingredientId: string; quantity: string; wastePercent: string }[];
};

export function RecipeDialog({
  ingredients,
  recipe,
  defaultType,
}: {
  ingredients: Ingredient[];
  recipe?: Recipe;
  defaultType?: RecipeType;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<RecipeType>(recipe?.type ?? defaultType ?? "PRODUCAO");
  const [rows, setRows] = useState<RecipeIngredientRow[]>(() =>
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((ing, index) => ({ key: `existing-${index}`, ...ing }))
      : [{ key: "row-0", ingredientId: "", quantity: "", wastePercent: "0" }],
  );

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = recipe
        ? await updateRecipe(recipe.id, undefined, formData)
        : await createRecipe(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: `row-${prev.length}-${Date.now()}`, ingredientId: "", quantity: "", wastePercent: "0" },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  function setRowIngredient(key: string, ingredientId: string | null) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ingredientId: ingredientId ?? "" } : row)),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setType(recipe?.type ?? defaultType ?? "PRODUCAO");
      }}
    >
      <DialogTrigger
        render={
          <Button variant={recipe ? "outline" : "default"} size="sm">
            {recipe ? "Editar" : "+ Nova receita"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{recipe ? "Editar receita" : "Nova receita"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Categoria</Label>
            <Select
              name="type"
              autoComplete="off"
              value={type}
              onValueChange={(value) => setType(value as RecipeType)}
              required
              items={RECIPE_TYPES}
            >
              <SelectTrigger id="type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECIPE_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome da receita</Label>
            <Input
              id="name"
              name="name"
              defaultValue={recipe?.name}
              placeholder="Ex: Calabresa, Massa de pizza, Carne de esfiha..."
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea id="description" name="description" defaultValue={recipe?.description ?? ""} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="instructions">Modo de preparo (opcional)</Label>
            <Textarea
              id="instructions"
              name="instructions"
              rows={5}
              placeholder="Descreva o passo a passo do preparo..."
              defaultValue={recipe?.instructions ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="yieldKg">Rendimento real (kg)</Label>
            <Input
              id="yieldKg"
              name="yieldKg"
              type="number"
              step="0.001"
              min="0"
              placeholder="Preencha após pesar o resultado da produção"
              defaultValue={recipe?.yieldKg ?? ""}
            />
            <p className="text-xs text-neutral-500">
              Peso final após o preparo (considera perdas de produção). Usado para calcular o
              custo por kg — deixe em branco se ainda não souber.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Ingredientes</Label>
            <div className="flex flex-col gap-3">
              {rows.map((row) => {
                const selected = ingredients.find((i) => i.id === row.ingredientId);
                return (
                  <div key={row.key} className="flex flex-col gap-1 rounded-lg border p-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Select
                          name="ingredientId"
                          autoComplete="off"
                          value={row.ingredientId || undefined}
                          onValueChange={(value) => setRowIngredient(row.key, value)}
                          required
                          items={ingredients.map((ingredient) => ({
                            value: ingredient.id,
                            label: ingredient.name,
                          }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.map((ingredient) => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          name="quantity"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Qtd."
                          defaultValue={row.quantity}
                          className="w-20"
                          required
                        />
                        <span className="w-8 text-xs text-neutral-500">{selected?.unit ?? ""}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.key)}
                        aria-label="Remover ingrediente"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      <Label className="text-xs text-neutral-500">% de perda no preparo</Label>
                      <Input
                        name="wastePercent"
                        type="number"
                        step="0.1"
                        min="0"
                        max="99"
                        placeholder="0"
                        defaultValue={row.wastePercent}
                        className="h-7 w-20"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: a cebola perde peso na limpeza — se você usa 100g líquidos mas perde 20% no
              preparo, informe 20% aqui, e o custo já é calculado considerando a quantidade bruta
              comprada.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="mt-1 self-start">
              + Adicionar ingrediente
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
