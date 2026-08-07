"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeVariableCostRate } from "./actions";

export function DeleteVariableCostButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este custo variável?")) return;
        startTransition(async () => {
          await removeVariableCostRate(id);
          toast.success("Custo variável removido.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
