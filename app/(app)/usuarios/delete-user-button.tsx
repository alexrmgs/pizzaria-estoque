"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteUser } from "./actions";

export function DeleteUserButton({
  id,
  name,
  disabled,
}: {
  id: string;
  name: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={disabled || isPending}
      onClick={() => {
        if (!confirm(`Excluir a conta de "${name}"? Essa ação não pode ser desfeita.`)) return;
        startTransition(async () => {
          try {
            await deleteUser(id);
            toast.success(`Conta de ${name} excluída.`);
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
