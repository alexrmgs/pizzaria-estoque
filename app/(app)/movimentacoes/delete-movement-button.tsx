"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteMovement } from "./actions";

export function DeleteMovementButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir essa movimentação? O estoque do ingrediente é ajustado de volta.")) return;
        startTransition(async () => {
          const result = await deleteMovement(id);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Movimentação excluída.");
          }
        });
      }}
    >
      Excluir
    </Button>
  );
}
