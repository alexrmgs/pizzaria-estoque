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
            'Recalcular o "estoque aceitável" e o "estoque mínimo" de todos os ingredientes? Vai sobrescrever os valores atuais com base no consumo dos últimos 30 dias: aceitável = consumo + 15%, mínimo = média diária × 2 dias.',
          )
        ) {
          return;
        }
        startTransition(async () => {
          const { atualizados, semHistorico } = await recalcularEstoqueAceitavel();
          toast.success(
            `${atualizados} ${atualizados === 1 ? "item atualizado" : "itens atualizados"}.` +
              (semHistorico > 0
                ? ` ${semHistorico} sem saída nos últimos 30 dias, ficaram de fora.`
                : ""),
          );
        });
      }}
    >
      {isPending ? "Recalculando..." : "Recalcular estoque mínimo/aceitável"}
    </Button>
  );
}
