"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { limparFilaPedidos } from "./actions";

export function LimparFilaButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function limpar() {
    if (!confirm("Limpar a fila? Isso apaga todas as etiquetas de pedido que ainda não foram impressas.")) {
      return;
    }
    startTransition(async () => {
      const result = await limparFilaPedidos();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Fila limpa (${result.apagados ?? 0} removidas) ✅`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={limpar}
      disabled={isPending}
      className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      <Trash2 className="size-3.5" /> Limpar fila
    </button>
  );
}
