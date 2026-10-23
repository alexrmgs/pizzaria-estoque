"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Tempo real" do PDV: recarrega os dados do servidor a cada `ms` enquanto a
 * aba está visível — pega pedido novo/movido por outra tela e atualiza os
 * cronômetros. Não renderiza nada.
 */
export function AtualizaSozinho({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
