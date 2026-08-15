"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { darBaixaLote } from "../actions";

export function ConfirmarBaixaButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const result = await darBaixaLote(id);
      if (result.error) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Baixa registrada ✅");
      router.refresh();
    });
  }

  return (
    <Button size="lg" className="mt-2 h-14 text-base" disabled={isPending} onClick={confirmar}>
      {isPending ? "Registrando…" : "Dar baixa (saída do estoque)"}
    </Button>
  );
}
