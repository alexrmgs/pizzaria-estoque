"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { duplicateRecipe } from "./actions";

export function DuplicateRecipeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await duplicateRecipe(id);
          toast.success("Receita duplicada.");
        });
      }}
    >
      Duplicar
    </Button>
  );
}
