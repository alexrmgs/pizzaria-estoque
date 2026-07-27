"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRecipe } from "./actions";

export function DeleteRecipeButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir a receita "${name}"?`)) return;
        startTransition(async () => {
          await deleteRecipe(id);
          toast.success("Receita excluída.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
