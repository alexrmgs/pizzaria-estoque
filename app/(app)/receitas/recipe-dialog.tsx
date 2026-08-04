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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { createRecipe, updateRecipe } from "./actions";
import { setIngredientRecipeUnit } from "../estoque/actions";
import { recipeItemCost } from "@/lib/recipe-cost";
import { X } from "lucide-react";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  recipeUnit: string | null;
  unitsPerPackage: string;
  unitPrice: string;
  correctionGrossWeight: string | null;
  correctionNetWeight: string | null;
};

/** % de perda sugerida a partir do fator de correção cadastrado no
 * ingrediente (peso bruto/líquido) — usada só como valor inicial ao
 * escolher o ingrediente na receita; o usuário pode ajustar por linha. */
function defaultWastePercent(ingredient: Ingredient): string | null {
  const gross = Number(ingredient.correctionGrossWeight);
  const net = Number(ingredient.correctionNetWeight);
  if (!gross || !net || net > gross) return null;
  return (((gross - net) / gross) * 100).toFixed(1);
}

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
  imageUrl: string | null;
  yieldKg: string | null;
  ingredients: { ingredientId: string; quantity: string; wastePercent: string }[];
};

const MAX_IMAGE_DIMENSION = 1000;
const IMAGE_QUALITY = 0.82;

/** Redimensiona a foto no navegador antes de enviar, pra não guardar fotos
 * de câmera de celular (vários MB) direto no banco. */
function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = document.createElement("img");
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type ConversionOverride = { recipeUnit: string | null; unitsPerPackage: string };

/** Conversão de unidade de compra -> unidade de receita, editável direto na
 * hora de montar a ficha (ex: fardo com 50 caixas, pote de 1,7kg usado em
 * gramas). Continua sendo salva no ingrediente (`canManageEstoque`), não na
 * receita — então some pra sempre depois de configurada uma vez. */
function ConversionEditor({
  ingredient,
  override,
  onSaved,
}: {
  ingredient: Ingredient;
  override?: ConversionOverride;
  onSaved: (ingredientId: string, override: ConversionOverride) => void;
}) {
  const current = override ?? { recipeUnit: ingredient.recipeUnit, unitsPerPackage: ingredient.unitsPerPackage };
  const [editing, setEditing] = useState(false);
  const [recipeUnit, setRecipeUnit] = useState(current.recipeUnit ?? "same");
  const [unitsPerPackage, setUnitsPerPackage] = useState(current.unitsPerPackage || "1");
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setRecipeUnit(current.recipeUnit ?? "same");
          setUnitsPerPackage(current.unitsPerPackage || "1");
          setEditing(true);
        }}
        className="text-left text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
      >
        {current.recipeUnit
          ? `Conversão: 1 ${ingredient.unit} = ${current.unitsPerPackage} ${current.recipeUnit} · editar`
          : `Receita em ${ingredient.unit}. Usa uma unidade menor (caixa avulsa, gramas)? Configurar`}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed p-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Unidade da receita</Label>
        <Select
          value={recipeUnit}
          onValueChange={(value) => value && setRecipeUnit(value)}
          items={[{ value: "same", label: `Mesma unidade (${ingredient.unit})` }, ...UNIT_OPTIONS]}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same">Mesma unidade ({ingredient.unit})</SelectItem>
            {UNIT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {recipeUnit !== "same" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            Quantas {recipeUnit} tem em 1 {ingredient.unit}?
          </Label>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={unitsPerPackage}
            onChange={(e) => setUnitsPerPackage(e.target.value)}
            className="h-8 w-28"
          />
        </div>
      )}
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={isPending}
        onClick={() => {
          const finalRecipeUnit = recipeUnit === "same" ? null : recipeUnit;
          const finalUnitsPerPackage = finalRecipeUnit ? Number(unitsPerPackage || "1") : 1;
          startTransition(async () => {
            try {
              await setIngredientRecipeUnit(ingredient.id, finalRecipeUnit, finalUnitsPerPackage);
              onSaved(ingredient.id, {
                recipeUnit: finalRecipeUnit,
                unitsPerPackage: String(finalUnitsPerPackage),
              });
              toast.success("Conversão salva no ingrediente.");
              setEditing(false);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
            }
          });
        }}
      >
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}

export function RecipeDialog({
  ingredients,
  recipe,
  defaultType,
  canManageEstoque,
}: {
  ingredients: Ingredient[];
  recipe?: Recipe;
  defaultType?: RecipeType;
  canManageEstoque: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<RecipeType>(recipe?.type ?? defaultType ?? "PRODUCAO");
  const [rows, setRows] = useState<RecipeIngredientRow[]>(() =>
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((ing, index) => ({ key: `existing-${index}`, ...ing }))
      : [{ key: "row-0", ingredientId: "", quantity: "", wastePercent: "0" }],
  );
  const [conversionOverrides, setConversionOverrides] = useState<Record<string, ConversionOverride>>({});
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(recipe?.imageUrl ?? null);
  const [imageError, setImageError] = useState<string | undefined>();
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  async function handleImageChange(file: File | null) {
    if (!file) return;
    setImageError(undefined);
    setIsProcessingImage(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImageDataUrl(dataUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    } finally {
      setIsProcessingImage(false);
    }
  }

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
    const selected = ingredients.find((i) => i.id === ingredientId);
    const suggestedWaste = selected ? defaultWastePercent(selected) : null;
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              ingredientId: ingredientId ?? "",
              wastePercent: suggestedWaste ?? row.wastePercent,
            }
          : row,
      ),
    );
  }

  function updateRow(key: string, patch: Partial<RecipeIngredientRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function rowCost(row: RecipeIngredientRow): number {
    const selected = ingredients.find((i) => i.id === row.ingredientId);
    if (!selected) return 0;
    const override = conversionOverrides[selected.id];
    const effectiveUnitsPerPackage = Number(override?.unitsPerPackage ?? selected.unitsPerPackage);
    return recipeItemCost(
      Number(row.quantity || 0),
      Number(row.wastePercent || 0),
      Number(selected.unitPrice),
      effectiveUnitsPerPackage,
    );
  }

  const totalCost = rows.reduce((sum, row) => sum + rowCost(row), 0);
  const ingredientComboItems = ingredients.map((ingredient) => ({
    value: ingredient.id,
    label: ingredient.name,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setType(recipe?.type ?? defaultType ?? "PRODUCAO");
          setImageDataUrl(recipe?.imageUrl ?? null);
          setImageError(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant={recipe ? "outline" : "default"} size="sm">
            {recipe ? "Editar" : "+ Nova receita"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
            <Label htmlFor="image">Foto do prato pronto (opcional)</Label>
            <input type="hidden" name="imageUrl" value={imageDataUrl ?? ""} />
            <div className="flex items-end gap-3">
              {imageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageDataUrl}
                  alt="Foto de referência do prato pronto"
                  className="h-24 w-24 rounded-lg border object-cover"
                />
              )}
              <div className="flex flex-col gap-2">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  disabled={isProcessingImage}
                  onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                />
                {imageDataUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setImageDataUrl(null)}
                  >
                    Remover foto
                  </Button>
                )}
              </div>
            </div>
            {isProcessingImage && <p className="text-xs text-neutral-500">Processando imagem...</p>}
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
            <p className="text-xs text-neutral-500">
              Mostra como o prato deve ficar pronto — aparece também na ficha impressa, como
              referência pra equipe.
            </p>
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
                const override = selected ? conversionOverrides[selected.id] : undefined;
                const effectiveRecipeUnit = override?.recipeUnit ?? selected?.recipeUnit ?? null;
                return (
                  <div key={row.key} className="flex flex-col gap-1 rounded-lg border p-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <input type="hidden" name="ingredientId" value={row.ingredientId} />
                        <Combobox
                          items={ingredientComboItems}
                          defaultValue={
                            row.ingredientId
                              ? ingredientComboItems.find((i) => i.value === row.ingredientId)
                              : undefined
                          }
                          onValueChange={(item: { value: string; label: string } | null) =>
                            setRowIngredient(row.key, item?.value ?? null)
                          }
                        >
                          <ComboboxInput placeholder="Buscar ingrediente..." autoComplete="off" />
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
                      <div className="flex items-center gap-1">
                        <Input
                          name="quantity"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Qtd."
                          value={row.quantity}
                          onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                          className="w-20"
                          required
                        />
                        <span className="w-8 text-xs text-neutral-500">
                          {effectiveRecipeUnit ?? selected?.unit ?? ""}
                        </span>
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
                    <div className="flex items-center justify-between gap-2 pl-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-neutral-500">% de perda no preparo</Label>
                        <Input
                          name="wastePercent"
                          type="number"
                          step="0.1"
                          min="0"
                          max="99"
                          placeholder="0"
                          value={row.wastePercent}
                          onChange={(e) => updateRow(row.key, { wastePercent: e.target.value })}
                          className="h-7 w-20"
                        />
                      </div>
                      {selected && (
                        <span className="text-xs font-medium text-primary">
                          ≈ {currency(rowCost(row))}
                        </span>
                      )}
                    </div>
                    {selected && canManageEstoque && (
                      <div className="pl-1">
                        <ConversionEditor
                          ingredient={selected}
                          override={override}
                          onSaved={(ingredientId, next) =>
                            setConversionOverrides((prev) => ({ ...prev, [ingredientId]: next }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between border-t pt-2 text-sm">
              <span className="font-medium">Custo total da receita</span>
              <span className="font-semibold text-primary">{currency(totalCost)}</span>
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
            <Button type="submit" disabled={isPending || isProcessingImage}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
