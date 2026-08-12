"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { marcarPaga, reabrirConta, excluirConta } from "./actions";

export function MarcarPagaButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      const r = await marcarPaga(id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Marcada como paga ✅");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={isPending}
      className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      Marcar paga
    </button>
  );
}

export function ReabrirButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      const r = await reabrirConta(id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Conta reaberta.");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={isPending}
      className="text-xs font-medium text-neutral-500 underline hover:text-neutral-700 disabled:opacity-50"
    >
      Reabrir
    </button>
  );
}

export function ExcluirButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function run() {
    if (!confirm("Excluir essa conta?")) return;
    startTransition(async () => {
      const r = await excluirConta(id);
      if (r.error) { toast.error(r.error); return; }
      toast.success("Conta excluída.");
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={isPending}
      className="text-xs font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
    >
      Excluir
    </button>
  );
}
