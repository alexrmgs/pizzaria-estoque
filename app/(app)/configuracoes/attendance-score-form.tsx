"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAttendanceScoreSettings } from "./actions";

type Tier = { minScore: number; bonus: number };
type Row = { key: string; minScore: string; bonus: string };

function tiersToRows(tiers: Tier[]): Row[] {
  return tiers.map((t, i) => ({
    key: `${i}-${Math.random()}`,
    minScore: String(t.minScore),
    bonus: String(t.bonus),
  }));
}

function newRow(): Row {
  return { key: `new-${Math.random()}`, minScore: "", bonus: "" };
}

export function AttendanceScoreForm({
  latePenaltyPoints,
  attendanceBonusTiers,
}: {
  latePenaltyPoints: string;
  attendanceBonusTiers: Tier[];
}) {
  const [rows, setRows] = useState<Row[]>(() => tiersToRows(attendanceBonusTiers));
  const [isPending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows(rows.filter((r) => r.key !== key));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAttendanceScoreSettings(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Pontuação de assiduidade salva.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        Cada funcionário começa o mês com 100 pontos de pontualidade. Atraso além da tolerância
        legal (5min) desconta pontos fixos por ocorrência. Qualquer falta ou atestado no período
        zera o bônus, não importa a pontuação. O bônus final é calculado na hora de fechar o
        pagamento e some da faixa correspondente à pontuação — some no pagamento do mês seguinte.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="latePenaltyPoints">Pontos perdidos por atraso</Label>
        <Input
          id="latePenaltyPoints"
          name="latePenaltyPoints"
          type="number"
          step="1"
          min="0"
          max="100"
          defaultValue={latePenaltyPoints}
          required
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Faixas de bônus por pontuação final</p>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Pontuação mínima</Label>
                <Input
                  name="tierMinScore"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={row.minScore}
                  onChange={(e) => updateRow(row.key, { minScore: e.target.value })}
                  required
                  className="h-9 w-32"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Bônus (R$)</Label>
                <Input
                  name="tierBonus"
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.bonus}
                  onChange={(e) => updateRow(row.key, { bonus: e.target.value })}
                  required
                  className="h-9 w-32"
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

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar pontuação e bônus"}
        </Button>
      </div>
    </form>
  );
}
