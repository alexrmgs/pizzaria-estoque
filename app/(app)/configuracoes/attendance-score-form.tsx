"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { updateAttendanceScoreSettings } from "./actions";

type BonusTier = { minScore: number; bonus: number };
type BonusRow = { key: string; minScore: string; bonus: string };
type StreakTier = { months: number; multiplier: number };
type StreakRow = { key: string; months: string; multiplier: string };

function bonusTiersToRows(tiers: BonusTier[]): BonusRow[] {
  return tiers.map((t, i) => ({
    key: `${i}-${Math.random()}`,
    minScore: String(t.minScore),
    bonus: String(t.bonus),
  }));
}

function newBonusRow(): BonusRow {
  return { key: `new-${Math.random()}`, minScore: "", bonus: "" };
}

function streakTiersToRows(tiers: StreakTier[]): StreakRow[] {
  return tiers.map((t, i) => ({
    key: `${i}-${Math.random()}`,
    months: String(t.months),
    multiplier: String(t.multiplier),
  }));
}

function newStreakRow(): StreakRow {
  return { key: `new-${Math.random()}`, months: "", multiplier: "" };
}

export function AttendanceScoreForm({
  latePenaltyPoints,
  attendanceBonusTiers,
  attendanceStreakTiers,
  attendanceBonusVisible,
}: {
  latePenaltyPoints: string;
  attendanceBonusTiers: BonusTier[];
  attendanceStreakTiers: StreakTier[];
  attendanceBonusVisible: boolean;
}) {
  const [bonusRows, setBonusRows] = useState<BonusRow[]>(() => bonusTiersToRows(attendanceBonusTiers));
  const [streakRows, setStreakRows] = useState<StreakRow[]>(() =>
    streakTiersToRows(attendanceStreakTiers),
  );
  const [bonusVisible, setBonusVisible] = useState(attendanceBonusVisible);
  const [isPending, startTransition] = useTransition();

  function updateBonusRow(key: string, patch: Partial<BonusRow>) {
    setBonusRows(bonusRows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeBonusRow(key: string) {
    setBonusRows(bonusRows.filter((r) => r.key !== key));
  }

  function updateStreakRow(key: string, patch: Partial<StreakRow>) {
    setStreakRows(streakRows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeStreakRow(key: string) {
    setStreakRows(streakRows.filter((r) => r.key !== key));
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
        zera o bônus daquele mês e reseta a sequência abaixo. O bônus final é calculado na hora de
        fechar o pagamento e some no pagamento do mês seguinte.
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
          {bonusRows.map((row) => (
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
                  onChange={(e) => updateBonusRow(row.key, { minScore: e.target.value })}
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
                  onChange={(e) => updateBonusRow(row.key, { bonus: e.target.value })}
                  required
                  className="h-9 w-32"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={bonusRows.length <= 1}
                onClick={() => removeBonusRow(row.key)}
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
          onClick={() => setBonusRows([...bonusRows, newBonusRow()])}
        >
          + Adicionar faixa
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Faixas por sequência de meses sem zerar</p>
        <p className="text-xs text-muted-foreground">
          Multiplica o bônus do mês conforme quantos meses seguidos o funcionário fecha sem falta
          nem atestado (o próprio mês em que ele bate a faixa já sai com o bônus multiplicado).
        </p>
        <div className="flex flex-col gap-2">
          {streakRows.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">A partir de quantos meses</Label>
                <Input
                  name="streakMonths"
                  type="number"
                  step="1"
                  min="0"
                  value={row.months}
                  onChange={(e) => updateStreakRow(row.key, { months: e.target.value })}
                  required
                  className="h-9 w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Multiplicador (x)</Label>
                <Input
                  name="streakMultiplier"
                  type="number"
                  step="0.1"
                  min="0"
                  value={row.multiplier}
                  onChange={(e) => updateStreakRow(row.key, { multiplier: e.target.value })}
                  required
                  className="h-9 w-32"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={streakRows.length <= 1}
                onClick={() => removeStreakRow(row.key)}
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
          onClick={() => setStreakRows([...streakRows, newStreakRow()])}
        >
          + Adicionar faixa
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <input type="hidden" name="attendanceBonusVisible" value={bonusVisible ? "on" : ""} />
        <label htmlFor="attendanceBonusVisible-cb" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="attendanceBonusVisible-cb"
            checked={bonusVisible}
            onCheckedChange={(v) => setBonusVisible(v === true)}
          />
          Mostrar o bônus estimado pro funcionário em Meu Ponto
        </label>
        <p className="pl-6 text-xs text-muted-foreground">
          Desligado, o funcionário deixa de ver a pontuação/sequência/bônus estimado na tela dele
          — o cálculo continua rodando por trás e valendo no fechamento do pagamento, só some da
          visão dele até você religar.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar pontuação e bônus"}
        </Button>
      </div>
    </form>
  );
}
