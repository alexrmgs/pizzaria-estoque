"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTimeEntry } from "../funcionarios/[id]/actions";

export function DeletePontoButton({ employeeId, id }: { employeeId: string; id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este registro de ponto?")) return;
        startTransition(async () => {
          await deleteTimeEntry(employeeId, id);
          toast.success("Registro removido.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
