"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recalcularEstoqueAceitavel } from "./actions";

export function RecalcularEstoqueAceitavelButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            'Recalcular o "estoque aceitável" de todos os ingredientes? Vai sobrescrever o valor atual de cada um pelo consumo médio semanal (últimos 90 dias) + 20%.',
          )
        ) {
          return;
        }
        startTransition(async () => {
          const { atualizados, semHistorico } = await recalcularEstoqueAceitavel();
          toast.success(
            `${atualizados} ${atualizados === 1 ? "item atualizado" : "itens atualizados"}.` +
              (semHistorico > 0
                ? ` ${semHistorico} sem saída nos últimos 90 dias, ficaram de fora.`
                : ""),
          );
        });
      }}
    >
      {isPending ? "Recalculando..." : "Recalcular estoque aceitável"}
    </Button>
  );
}
