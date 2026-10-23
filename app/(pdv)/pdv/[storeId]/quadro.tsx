"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { PedidoCard, StatusColuna, type PedidoResumo } from "@/components/pdv/cards";
import { PdvButton } from "@/components/pdv/primitives";
import { moverStatus } from "./actions";

export type ColunaQuadro = {
  id: string;
  nome: string;
  cor: string;
  primeira: boolean;
  ultima: boolean;
  pedidos: (PedidoResumo & { id: string })[];
};

const ATUALIZA_MS = 4000;

export function QuadroPedidos({ storeId, colunas }: { storeId: string; colunas: ColunaQuadro[] }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  // "tempo real" da fatia 1: recarrega os dados do servidor a cada 4s
  // enquanto a aba está visível (outra tela/caixa lançou ou moveu pedido).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ATUALIZA_MS);
    return () => clearInterval(id);
  }, [router]);

  function mover(vendaId: string, sentido: 1 | -1) {
    startTransition(async () => {
      const r = await moverStatus(storeId, vendaId, sentido);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  const total = colunas.reduce((s, c) => s + c.pedidos.length, 0);

  return (
    <main className="flex flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex items-center gap-3">
        <h1 className="font-pdv-display text-xl font-extrabold">Pedidos de hoje</h1>
        <span className="font-mono text-sm text-pdv-muted">{total}</span>
        <Link
          href={`/pdv/${storeId}/nova`}
          className="ml-auto inline-flex h-12 items-center gap-2 rounded-pdv-md bg-pdv-accent px-4 font-semibold text-pdv-on-accent outline-none hover:bg-pdv-accent-hover focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pdv-bg"
        >
          <Plus className="size-5" aria-hidden /> Nova venda
        </Link>
      </div>

      <div className="flex flex-1 snap-x gap-3 overflow-x-auto pb-2" aria-busy={pendente}>
        {colunas.map((c) => (
          <StatusColuna key={c.id} nome={c.nome} cor={c.cor} quantidade={c.pedidos.length}>
            {c.pedidos.map((p) => (
              <div key={p.id} className="flex snap-start flex-col gap-1">
                <PedidoCard pedido={p} onAbrir={() => router.push(`/pdv/${storeId}/pedido/${p.id}`)} />
                <div className="flex gap-1">
                  {!c.primeira ? (
                    <PdvButton size="sm" variant="ghost" onClick={() => mover(p.id, -1)} disabled={pendente} aria-label={`Voltar pedido ${p.numero}`}>
                      <ChevronLeft />
                    </PdvButton>
                  ) : null}
                  {!c.ultima ? (
                    <PdvButton size="sm" className="flex-1" onClick={() => mover(p.id, 1)} disabled={pendente}>
                      Avançar <ChevronRight />
                    </PdvButton>
                  ) : null}
                </div>
              </div>
            ))}
          </StatusColuna>
        ))}
      </div>
    </main>
  );
}
