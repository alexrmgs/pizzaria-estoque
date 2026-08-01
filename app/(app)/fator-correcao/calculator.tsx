"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";

type Ingredient = { id: string; name: string };

type CalculatedRow = {
  key: string;
  name: string;
  pesoBruto: number;
  pesoLiquido: number;
  fator: number;
  perdaPercent: number;
};

const NO_INGREDIENT = "__none__";

export function CorrectionFactorCalculator({ ingredients }: { ingredients: Ingredient[] }) {
  const [ingredientId, setIngredientId] = useState(NO_INGREDIENT);
  const [customName, setCustomName] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");
  const [pesoLiquido, setPesoLiquido] = useState("");
  const [rows, setRows] = useState<CalculatedRow[]>([]);

  const brutoNum = Number(pesoBruto || 0);
  const liquidoNum = Number(pesoLiquido || 0);
  const fatorPreview = brutoNum > 0 && liquidoNum > 0 ? brutoNum / liquidoNum : null;
  const perdaPreview = brutoNum > 0 && liquidoNum > 0 ? (1 - liquidoNum / brutoNum) * 100 : null;

  const selectedIngredientName = ingredients.find((i) => i.id === ingredientId)?.name;

  function handleAdd() {
    if (brutoNum <= 0 || liquidoNum <= 0) return;
    if (liquidoNum > brutoNum) return;

    const name = selectedIngredientName ?? customName.trim() ?? "";

    setRows((prev) => [
      {
        key: `${Date.now()}-${Math.random()}`,
        name: name || "—",
        pesoBruto: brutoNum,
        pesoLiquido: liquidoNum,
        fator: brutoNum / liquidoNum,
        perdaPercent: (1 - liquidoNum / brutoNum) * 100,
      },
      ...prev,
    ]);
    setPesoBruto("");
    setPesoLiquido("");
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  const invalid = brutoNum > 0 && liquidoNum > 0 && liquidoNum > brutoNum;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calcular</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ingredientId">Ingrediente (opcional)</Label>
              <Select
                value={ingredientId}
                onValueChange={(v) => setIngredientId(v ?? NO_INGREDIENT)}
                items={[
                  { value: NO_INGREDIENT, label: "Nenhum / digitar nome" },
                  ...ingredients.map((i) => ({ value: i.id, label: i.name })),
                ]}
              >
                <SelectTrigger id="ingredientId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_INGREDIENT}>Nenhum / digitar nome</SelectItem>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ingredientId === NO_INGREDIENT && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="customName">Nome (opcional)</Label>
                <Input
                  id="customName"
                  placeholder="Ex: Cebola"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pesoBruto">Peso bruto (como comprado)</Label>
              <Input
                id="pesoBruto"
                type="number"
                step="0.001"
                min="0"
                value={pesoBruto}
                onChange={(e) => setPesoBruto(e.target.value)}
                placeholder="Ex: 1000 (gramas) ou 1 (kg)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pesoLiquido">Peso líquido (depois de limpo/preparado)</Label>
              <Input
                id="pesoLiquido"
                type="number"
                step="0.001"
                min="0"
                value={pesoLiquido}
                onChange={(e) => setPesoLiquido(e.target.value)}
                placeholder="Ex: 800 (gramas) ou 0,8 (kg)"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Use a mesma unidade nos dois campos (os dois em gramas, ou os dois em kg — não
            importa qual, contanto que seja igual).
          </p>

          {invalid && (
            <p className="text-sm text-destructive">
              O peso líquido não pode ser maior que o peso bruto.
            </p>
          )}

          {fatorPreview !== null && !invalid && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm">
                Fator de correção: <span className="font-semibold text-primary">{fatorPreview.toFixed(3)}</span>
                {" · "}
                Perda: <span className="font-semibold">{perdaPreview!.toFixed(1)}%</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Pra ter 1kg líquido desse ingrediente, precisa comprar {fatorPreview.toFixed(3)}kg
                bruto.
              </p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleAdd}
            disabled={brutoNum <= 0 || liquidoNum <= 0 || invalid}
            className="self-start"
          >
            Calcular e adicionar à lista
          </Button>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cálculos ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Peso bruto</TableHead>
                    <TableHead>Peso líquido</TableHead>
                    <TableHead>Fator de correção</TableHead>
                    <TableHead>Perda</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.pesoBruto}</TableCell>
                      <TableCell>{row.pesoLiquido}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {row.fator.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {row.perdaPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(row.key)}
                          aria-label="Remover"
                        >
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Use o fator de correção como referência pra preencher o campo &quot;% de perda no
              preparo&quot; ao montar uma receita (perda = fator de correção convertido em
              porcentagem, mostrado na coluna &quot;Perda&quot; acima).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
