"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateSalaryAdvances } from "./actions";

export function GenerateAdvancesButton() {
  const [isPending, startTransition] = useTransition();
  const [formaPagamento, setFormaPagamento] = useState<"DINHEIRO" | "PIX">("DINHEIRO");

  function handleClick() {
    if (
      !confirm(
        `Gerar o adiantamento de 40% do salário bruto (dia 20) em ${
          formaPagamento === "PIX" ? "Pix" : "dinheiro"
        } para todos os funcionários ativos? Quem já tiver esse adiantamento lançado neste mês é pulado.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await generateSalaryAdvances(formaPagamento);
      if (result.created === 0) {
        toast.info("Nenhum adiantamento novo — todos já tinham sido gerados este mês.");
      } else {
        toast.success(
          `${result.created} adiantamento(s) lançado(s).${
            result.skipped > 0 ? ` ${result.skipped} já existiam e foram pulados.` : ""
          }`,
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={formaPagamento}
        onChange={(e) => setFormaPagamento(e.target.value as "DINHEIRO" | "PIX")}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="DINHEIRO">Dinheiro</option>
        <option value="PIX">Pix</option>
      </select>
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? "Gerando..." : "Gerar adiantamento do dia 20 (40%)"}
      </Button>
    </div>
  );
}
