"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { removerConexao } from "./actions";

export function RemoveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remover() {
    if (!confirm(`Remover a conexão com ${name}?`)) return;
    startTransition(async () => {
      const result = await removerConexao(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conexão removida.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remover}
      disabled={isPending}
      className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      <Trash2 className="size-3.5" /> Remover
    </button>
  );
}
