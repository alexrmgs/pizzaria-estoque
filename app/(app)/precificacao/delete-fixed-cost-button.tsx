"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeFixedCost } from "./actions";

export function DeleteFixedCostButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este custo fixo?")) return;
        startTransition(async () => {
          await removeFixedCost(id);
          toast.success("Custo fixo removido.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
