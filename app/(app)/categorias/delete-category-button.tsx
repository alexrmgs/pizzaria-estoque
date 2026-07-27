"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "./actions";

export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir a categoria "${name}"? Os ingredientes ficarão sem categoria.`)) return;
        startTransition(async () => {
          await deleteCategory(id);
          toast.success("Categoria excluída.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
