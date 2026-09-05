"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCltDeductions } from "./actions";

type Bracket = { upTo: number | null; rate: number };
type Row = { key: string; upTo: string; ratePercent: string };

function bracketsToRows(brackets: Bracket[]): Row[] {
  return brackets.map((b, i) => ({
    key: `${i}-${Math.random()}`,
    upTo: b.upTo === null ? "" : String(b.upTo),
    ratePercent: String(b.rate * 100),
  }));
}

function newRow(): Row {
  return { key: `new-${Math.random()}`, upTo: "", ratePercent: "" };
}

function BracketTable({
  title,
  fieldPrefix,
  rows,
  setRows,
  lastRowHint,
}: {
  title: string;
  fieldPrefix: "inss" | "irrf";
  rows: Row[];
  setRows: (rows: Row[]) => void;
  lastRowHint: string;
}) {
  function updateRow(key: string, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows(rows.filter((r) => r.key !== key));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={row.key} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs">Até R$ (vazio = sem teto)</Label>
              <Input
                name={`${fieldPrefix}UpTo`}
                type="number"
                step="0.01"
                min="0"
                value={row.upTo}
                onChange={(e) => updateRow(row.key, { upTo: e.target.value })}
                placeholder={i === rows.length - 1 ? lastRowHint : ""}
                className="h-9"
              />
            </div>
            <div className="flex w-28 flex-col gap-1">
              <Label className="text-xs">Alíquota %</Label>
              <Input
                name={`${fieldPrefix}Rate`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={row.ratePercent}
                onChange={(e) => updateRow(row.key, { ratePercent: e.target.value })}
                required
                className="h-9"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => removeRow(row.key)}
            >
              Remover
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => setRows([...rows, newRow()])}
      >
        + Adicionar faixa
      </Button>
    </div>
  );
}

export function CltDeductionsForm({
  inssBrackets,
  irrfBrackets,
  irrfDependentDeduction,
  valeTransporteRate,
  valorFixoMadrugada,
}: {
  inssBrackets: Bracket[];
  irrfBrackets: Bracket[];
  irrfDependentDeduction: string;
  valeTransporteRate: string;
  valorFixoMadrugada: string;
}) {
  const [inssRows, setInssRows] = useState<Row[]>(() => bracketsToRows(inssBrackets));
  const [irrfRows, setIrrfRows] = useState<Row[]>(() => bracketsToRows(irrfBrackets));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCltDeductions(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Tabelas de desconto salvas.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        Essas tabelas mudam todo ano (INSS e IRRF são reajustados pela Receita Federal). Confira e
        atualize os valores antes de usar — os descontos só são aplicados se você marcar a opção
        na hora de fechar o pagamento de cada funcionário.
      </p>

      <BracketTable
        title="INSS (tem teto — a última faixa precisa de um valor)"
        fieldPrefix="inss"
        rows={inssRows}
        setRows={setInssRows}
        lastRowHint="teto obrigatório"
      />

      <BracketTable
        title="IRRF (a última faixa fica sem teto)"
        fieldPrefix="irrf"
        rows={irrfRows}
        setRows={setIrrfRows}
        lastRowHint="sem teto"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="irrfDependentDeduction">Dedução por dependente (R$)</Label>
          <Input
            id="irrfDependentDeduction"
            name="irrfDependentDeduction"
            type="number"
            step="0.01"
            min="0"
            defaultValue={irrfDependentDeduction}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="valeTransporteRate">Vale-transporte (%)</Label>
          <Input
            id="valeTransporteRate"
            name="valeTransporteRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={valeTransporteRate}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="valorFixoMadrugada">Valor fixo por madrugada (R$)</Label>
          <Input
            id="valorFixoMadrugada"
            name="valorFixoMadrugada"
            type="number"
            step="0.01"
            min="0"
            defaultValue={valorFixoMadrugada}
            required
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Usado como valor padrão ao lançar um pagamento de madrugada em &quot;Madrugada&quot; — dá
        pra editar em cada lançamento se precisar.
      </p>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar tabelas de desconto"}
        </Button>
      </div>
    </form>
  );
}
