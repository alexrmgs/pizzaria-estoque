"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeAdvance } from "./actions";

export function DeleteValeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este vale?")) return;
        startTransition(async () => {
          await removeAdvance(id);
          toast.success("Vale removido.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
