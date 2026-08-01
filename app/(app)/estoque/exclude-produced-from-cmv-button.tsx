"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { excludeProducedFromCmv } from "./actions";

export function ExcludeProducedFromCmvButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            'Tirar todos os itens de "Estoque de Produção" do cálculo do CMV? Isso evita contar o custo duas vezes (insumos crus + item produzido).',
          )
        ) {
          return;
        }
        startTransition(async () => {
          const { count } = await excludeProducedFromCmv();
          toast.success(
            count > 0
              ? `${count} ${count === 1 ? "item tirado" : "itens tirados"} do cálculo do CMV.`
              : "Nenhum item precisava ser alterado — já estavam todos fora do CMV.",
          );
        });
      }}
    >
      {isPending ? "Atualizando..." : "Remover todos do CMV"}
    </Button>
  );
}
