"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteFornecedor } from "./actions";

export function DeleteFornecedorButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir o fornecedor "${name}"? Movimentações já lançadas continuam, só perdem o vínculo.`))
          return;
        startTransition(async () => {
          await deleteFornecedor(id);
          toast.success("Fornecedor excluído.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
