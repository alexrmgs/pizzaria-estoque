"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "./actions";

type Settings = {
  overtimeMode: "HORA_EXTRA" | "BANCO_HORAS";
  dailyExpectedHours: string;
  overtimeRate: string;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSettings(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Configurações salvas.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="overtimeMode">Excedente da jornada</Label>
        <Select
          name="overtimeMode"
          autoComplete="off"
          defaultValue={settings.overtimeMode}
          required
          items={[
            { value: "HORA_EXTRA", label: "Hora extra paga" },
            { value: "BANCO_HORAS", label: "Banco de horas" },
          ]}
        >
          <SelectTrigger id="overtimeMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HORA_EXTRA">Hora extra paga</SelectItem>
            <SelectItem value="BANCO_HORAS">Banco de horas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Vale para todos os funcionários. Quando alguém passa da jornada diária, o excedente
          vira valor no fechamento do pagamento (hora extra) ou só acumula saldo de horas (banco).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dailyExpectedHours">Jornada diária esperada (h)</Label>
          <Input
            id="dailyExpectedHours"
            name="dailyExpectedHours"
            type="number"
            step="0.5"
            min="0"
            defaultValue={settings.dailyExpectedHours}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="overtimeRate">Multiplicador da hora extra</Label>
          <Input
            id="overtimeRate"
            name="overtimeRate"
            type="number"
            step="0.1"
            min="1"
            defaultValue={settings.overtimeRate}
            required
          />
          <p className="text-xs text-muted-foreground">
            1.5 = paga 50% a mais por hora extra. Só é usado no modo &quot;Hora extra paga&quot;.
          </p>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
