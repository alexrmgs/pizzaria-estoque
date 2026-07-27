"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteStore } from "./actions";

export function DeleteStoreButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir a loja "${name}"?`)) return;
        startTransition(async () => {
          try {
            await deleteStore(id);
            toast.success("Loja excluída.");
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
