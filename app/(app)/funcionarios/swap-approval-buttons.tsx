"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondToSwapAsManager } from "./actions";

export function SwapApprovalButtons({ swapId }: { swapId: string }) {
  const [isPending, startTransition] = useTransition();

  function respond(approve: boolean) {
    if (approve && !confirm("Aprovar essa troca de folga? As folgas dos dois funcionários já são ajustadas.")) {
      return;
    }
    startTransition(async () => {
      try {
        await respondToSwapAsManager(swapId, approve);
        toast.success(approve ? "Troca aprovada e folgas ajustadas." : "Troca recusada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível responder.");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isPending} onClick={() => respond(true)}>
        Aprovar
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => respond(false)}>
        Recusar
      </Button>
    </div>
  );
}
