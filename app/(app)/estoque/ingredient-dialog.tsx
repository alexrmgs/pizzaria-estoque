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

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  recipeUnit: string | null;
  unitsPerPackage: string;
  correctionGrossWeight: string | null;
  correctionNetWeight: string | null;
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
  const [unit, setUnit] = useState(ingredient?.unit ?? "KG");
  const [recipeUnit, setRecipeUnit] = useState(ingredient?.recipeUnit ?? "same");
  const [grossWeight, setGrossWeight] = useState(ingredient?.correctionGrossWeight ?? "");
  const [netWeight, setNetWeight] = useState(ingredient?.correctionNetWeight ?? "");
  const [unitPrice, setUnitPrice] = useState(ingredient?.unitPrice ?? "");

  const grossNum = Number(grossWeight || 0);
  const netNum = Number(netWeight || 0);
  const correctionFactor = grossNum > 0 && netNum > 0 ? grossNum / netNum : null;
  const correctionInvalid = grossNum > 0 && netNum > 0 && netNum > grossNum;
  const costPerNetUnit = correctionFactor !== null ? Number(unitPrice || 0) * correctionFactor : null;

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
        if (next) {
          setError(undefined);
          setUnit(ingredient?.unit ?? "KG");
          setRecipeUnit(ingredient?.recipeUnit ?? "same");
          setGrossWeight(ingredient?.correctionGrossWeight ?? "");
          setNetWeight(ingredient?.correctionNetWeight ?? "");
          setUnitPrice(ingredient?.unitPrice ?? "");
        }
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
                value={unit}
                onValueChange={(value) => value && setUnit(value)}
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
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
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

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label htmlFor="recipeUnit">Unidade usada nas receitas (opcional)</Label>
            <Select
              name="recipeUnit"
              autoComplete="off"
              value={recipeUnit}
              onValueChange={(value) => value && setRecipeUnit(value)}
              items={[{ value: "same", label: "Mesma unidade do estoque" }, ...UNIT_OPTIONS]}
            >
              <SelectTrigger id="recipeUnit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Mesma unidade do estoque</SelectItem>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use quando a ficha técnica precisa de uma unidade menor do que a comprada — ex:
              estoque em FARDO mas a receita usa CX, ou estoque em UN (pote de 1,7kg) mas a receita
              usa G.
            </p>
            {recipeUnit !== "same" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="unitsPerPackage">
                  Quantas {recipeUnit} tem em 1 {unit}?
                </Label>
                <Input
                  id="unitsPerPackage"
                  name="unitsPerPackage"
                  type="number"
                  step="0.001"
                  min="0.001"
                  defaultValue={ingredient?.unitsPerPackage ?? "1"}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <Label>Fator de correção (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Peso bruto (como comprado) e peso líquido (depois de limpo/preparado) — ex: 1kg de
              cebola que sobra 800g limpa. Usado como sugestão de &quot;% de perda no
              preparo&quot; ao montar fichas técnicas com esse ingrediente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="correctionGrossWeight" className="text-xs">
                  Peso bruto
                </Label>
                <Input
                  id="correctionGrossWeight"
                  name="correctionGrossWeight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  placeholder="Ex: 1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="correctionNetWeight" className="text-xs">
                  Peso líquido
                </Label>
                <Input
                  id="correctionNetWeight"
                  name="correctionNetWeight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={netWeight}
                  onChange={(e) => setNetWeight(e.target.value)}
                  placeholder="Ex: 0,8"
                />
              </div>
            </div>
            {correctionInvalid && (
              <p className="text-xs text-destructive">
                O peso líquido não pode ser maior que o peso bruto.
              </p>
            )}
            {correctionFactor !== null && !correctionInvalid && (
              <p className="text-xs text-primary">
                Fator de correção: <span className="font-semibold">{correctionFactor.toFixed(3)}</span>
                {" · "}
                Perda: <span className="font-semibold">{((1 - netNum / grossNum) * 100).toFixed(1)}%</span>
                {costPerNetUnit !== null && (
                  <>
                    {" · "}
                    Custo do {unit} limpo:{" "}
                    <span className="font-semibold">{currency(costPerNetUnit)}</span>
                  </>
                )}
              </p>
            )}
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
            <Button type="submit" disabled={isPending || correctionInvalid}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
