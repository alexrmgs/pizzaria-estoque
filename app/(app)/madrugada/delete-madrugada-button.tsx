"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeMadrugadaPayment } from "./actions";

export function DeleteMadrugadaButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir este pagamento de madrugada?")) return;
        startTransition(async () => {
          await removeMadrugadaPayment(id);
          toast.success("Pagamento removido.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
