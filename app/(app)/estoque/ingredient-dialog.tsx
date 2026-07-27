"use client";

import { useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createIngredient, updateIngredient } from "./actions";

const UNIT_OPTIONS = [
  { value: "KG", label: "Quilograma (KG)" },
  { value: "G", label: "Grama (G)" },
  { value: "L", label: "Litro (L)" },
  { value: "ML", label: "Mililitro (ML)" },
  { value: "UN", label: "Unidade (UN)" },
  { value: "PECA", label: "Peça" },
  { value: "FARDO", label: "Fardo" },
  { value: "PCT", label: "Pacote (PCT)" },
  { value: "CX", label: "Caixa (CX)" },
];

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  unitPrice: string;
  minStock: string;
  idealStock: string | null;
  includeInCmv: boolean;
  isProduced: boolean;
  categoryId: string | null;
};

type Category = { id: string; name: string };

export function IngredientDialog({
  ingredient,
  categories,
}: {
  ingredient?: Ingredient;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = ingredient
        ? await updateIngredient(ingredient.id, undefined, formData)
        : await createIngredient(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button variant={ingredient ? "outline" : "default"} size="sm">
            {ingredient ? "Editar" : "+ Novo ingrediente"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ingredient ? "Editar ingrediente" : "Novo ingrediente"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              defaultValue={ingredient?.name}
              placeholder="Ex: Queijo mussarela"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="unit">Unidade de medida</Label>
              <Select
                name="unit"
                autoComplete="off"
                defaultValue={ingredient?.unit ?? "KG"}
                required
                items={UNIT_OPTIONS}
              >
                <SelectTrigger id="unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unitPrice">Preço por unidade (R$)</Label>
              <Input
                id="unitPrice"
                name="unitPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={ingredient?.unitPrice}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <Select
              name="categoryId"
              autoComplete="off"
              defaultValue={ingredient?.categoryId ?? "none"}
              items={[
                { value: "none", label: "Sem categoria" },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            >
              <SelectTrigger id="categoryId" className="w-full">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="minStock">Estoque mínimo</Label>
              <Input
                id="minStock"
                name="minStock"
                type="number"
                step="0.001"
                min="0"
                defaultValue={ingredient?.minStock}
                required
              />
              <p className="text-xs text-muted-foreground">Abaixo disso, gera alerta.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="idealStock">Estoque aceitável</Label>
              <Input
                id="idealStock"
                name="idealStock"
                type="number"
                step="0.001"
                min="0"
                placeholder="Opcional"
                defaultValue={ingredient?.idealStock ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Nível ideal para a lista de compras.
              </p>
            </div>
          </div>
          <label htmlFor="includeInCmv" className="flex items-start gap-2">
            <Checkbox
              id="includeInCmv"
              name="includeInCmv"
              defaultChecked={ingredient?.includeInCmv ?? true}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Faz parte do cálculo do CMV</span>
              <span className="text-xs text-muted-foreground">
                Desmarque para itens que não são vendidos, como material de limpeza ou escritório.
              </span>
            </span>
          </label>

          <label htmlFor="isProduced" className="flex items-start gap-2">
            <Checkbox
              id="isProduced"
              name="isProduced"
              defaultChecked={ingredient?.isProduced ?? false}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">Produzido internamente</span>
              <span className="text-xs text-muted-foreground">
                Item preparado na cozinha (não comprado pronto). Aparece no Plano de Produção.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
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
