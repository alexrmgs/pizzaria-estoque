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
import { cn } from "@/lib/utils";
import { updateMovement } from "./actions";

type Ingredient = { id: string; name: string; unit: string; currentStock: number };
type Fornecedor = { id: string; name: string };

type MovementValues = {
  id: string;
  ingredientId: string;
  type: "ENTRADA" | "SAIDA";
  quantity: string;
  reason: string | null;
  supplierId: string | null;
};

const formatQty = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function EditMovementDialog({
  movement,
  ingredients,
  fornecedores = [],
}: {
  movement: MovementValues;
  ingredients: Ingredient[];
  fornecedores?: Fornecedor[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [ingredientId, setIngredientId] = useState(movement.ingredientId);
  const [type, setType] = useState<"ENTRADA" | "SAIDA">(movement.type);
  const [quantity, setQuantity] = useState(movement.quantity);
  const [supplierId, setSupplierId] = useState(movement.supplierId ?? "");

  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const previewIngredient = ingredientById.get(ingredientId);
  const previewQuantityNumber = Number(quantity);
  const oldDelta =
    ingredientId === movement.ingredientId
      ? (movement.type === "ENTRADA" ? 1 : -1) * Number(movement.quantity)
      : 0;
  const resultingStock =
    previewIngredient && previewQuantityNumber > 0
      ? previewIngredient.currentStock - oldDelta + (type === "ENTRADA" ? 1 : -1) * previewQuantityNumber
      : null;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateMovement(movement.id, undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        toast.success("Movimentação atualizada.");
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
          setIngredientId(movement.ingredientId);
          setType(movement.type);
          setQuantity(movement.quantity);
          setSupplierId(movement.supplierId ?? "");
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm">Editar</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar movimentação</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ingredientId">Ingrediente</Label>
            <input type="hidden" name="ingredientId" value={ingredientId} />
            <Select
              value={ingredientId || undefined}
              onValueChange={(v) => setIngredientId(v ?? "")}
              items={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
            >
              <SelectTrigger id="ingredientId" className="w-full">
                <SelectValue placeholder="Selecione o ingrediente" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Tipo</Label>
            <input type="hidden" name="type" value={type} />
            <Select
              value={type}
              onValueChange={(v) => setType(v as "ENTRADA" | "SAIDA")}
              items={[
                { value: "ENTRADA", label: "Entrada" },
                { value: "SAIDA", label: "Saída" },
              ]}
            >
              <SelectTrigger id="type" className="w-full">
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
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            {previewIngredient && (
              <p className="text-xs text-neutral-500">
                Estoque atual: {formatQty(previewIngredient.currentStock)} {previewIngredient.unit}
                {resultingStock !== null && (
                  <>
                    {" "}
                    · ficará:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        resultingStock < 0
                          ? "text-destructive"
                          : type === "ENTRADA"
                            ? "text-primary"
                            : "text-foreground",
                      )}
                    >
                      {formatQty(resultingStock)} {previewIngredient.unit}
                    </span>
                    {resultingStock < 0 && " (estoque ficaria negativo)"}
                  </>
                )}
              </p>
            )}
          </div>

          {type === "ENTRADA" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="unitPrice">Preço de compra dessa vez (opcional)</Label>
              <Input
                id="unitPrice"
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

          {type === "ENTRADA" && fornecedores.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplierId">Fornecedor (opcional)</Label>
              <select
                id="supplierId"
                name="supplierId"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Sem fornecedor</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea id="reason" name="reason" defaultValue={movement.reason ?? ""} />
          </div>

          <p className="text-xs text-muted-foreground">
            O estoque do ingrediente é recalculado automaticamente ao salvar.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !ingredientId}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
