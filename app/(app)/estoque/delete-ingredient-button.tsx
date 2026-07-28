"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteIngredient } from "./actions";

export function DeleteIngredientButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir o ingrediente "${name}"?`)) return;
        startTransition(async () => {
          try {
            await deleteIngredient(id);
            toast.success("Ingrediente excluído.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
          }
        });
      }}
    >
      Excluir
    </Button>
  );
}
