"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updatePricing } from "../receitas/actions";
import { RECIPE_TYPE_LABELS } from "@/lib/recipe-cost";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_CMV_PERCENT = "30";

type PricingRowData = {
  id: string;
  name: string;
  type: "PIZZA" | "BEIRUTE" | "ESFIHA";
  costPerUnit: number | null;
  targetCmvPercent: string | null;
  sellingPrice: string | null;
};

function PricingRowFields({ row, disabled }: { row: PricingRowData; disabled: boolean }) {
  const [cmv, setCmv] = useState(row.targetCmvPercent ?? DEFAULT_CMV_PERCENT);
  const [price, setPrice] = useState(row.sellingPrice ?? "");

  const cmvNumber = Number(cmv);
  const suggestedPrice =
    row.costPerUnit !== null && cmvNumber > 0 ? row.costPerUnit / (cmvNumber / 100) : null;
  const priceNumber = Number(price);
  const realMargin =
    priceNumber > 0 && row.costPerUnit !== null
      ? ((priceNumber - row.costPerUnit) / priceNumber) * 100
      : null;
  const belowSuggested = suggestedPrice !== null && priceNumber > 0 && priceNumber < suggestedPrice;

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-neutral-500">
        {row.costPerUnit !== null ? currency(row.costPerUnit) : "—"}
      </TableCell>
      <TableCell>
        <input type="hidden" name="recipeId" value={row.id} />
        <Input
          name="targetCmvPercent"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={cmv}
          onChange={(e) => setCmv(e.target.value)}
          disabled={disabled}
          className="h-8 w-20"
        />
      </TableCell>
      <TableCell className="font-medium text-primary">
        {suggestedPrice !== null ? currency(suggestedPrice) : "—"}
      </TableCell>
      <TableCell>
        <Input
          name="sellingPrice"
          type="number"
          step="0.01"
          min="0"
          placeholder="—"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={disabled}
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell className="text-neutral-500">
        {realMargin !== null ? `${realMargin.toFixed(1)}%` : "—"}
      </TableCell>
      <TableCell>{belowSuggested && <Badge variant="destructive">Abaixo do sugerido</Badge>}</TableCell>
    </TableRow>
  );
}

export function PricingTable({
  rows,
  canManage,
}: {
  rows: PricingRowData[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePricing(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Precificação salva.");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nenhuma ficha de pizza, beirute ou esfiha cadastrada ainda — cadastre em Receitas.
      </p>
    );
  }

  const grouped: Record<"PIZZA" | "BEIRUTE" | "ESFIHA", PricingRowData[]> = {
    PIZZA: rows.filter((r) => r.type === "PIZZA"),
    BEIRUTE: rows.filter((r) => r.type === "BEIRUTE"),
    ESFIHA: rows.filter((r) => r.type === "ESFIHA"),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">💲 Precificação por unidade</CardTitle>
        <p className="text-sm text-neutral-500">
          Defina o CMV alvo (% do preço de venda que o custo do ingrediente pode representar) pra
          ver o preço sugerido de cada item, e compare com o preço que você realmente cobra hoje.
        </p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Custo/un.</TableHead>
                  <TableHead>CMV alvo (%)</TableHead>
                  <TableHead>Preço sugerido</TableHead>
                  <TableHead>Preço de venda atual</TableHead>
                  <TableHead>Margem real</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.keys(grouped) as (keyof typeof grouped)[]).map((type) =>
                  grouped[type].length > 0 ? (
                    <Fragment key={type}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={7} className="text-xs font-semibold text-neutral-500">
                          {RECIPE_TYPE_LABELS[type]}
                        </TableCell>
                      </TableRow>
                      {grouped[type].map((row) => (
                        <PricingRowFields key={row.id} row={row} disabled={!canManage} />
                      ))}
                    </Fragment>
                  ) : null,
                )}
              </TableBody>
            </Table>
          </div>
          {canManage && (
            <Button type="submit" disabled={isPending} className="self-start">
              {isPending ? "Salvando..." : "Salvar precificação"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
