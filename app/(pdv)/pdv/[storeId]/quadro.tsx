"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Phone, Store } from "lucide-react";
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-pdv-display text-xl font-extrabold">Pedidos de hoje</h1>
        <span className="font-mono text-sm text-pdv-muted">{total}</span>
        {/* como no balcão de pizzaria: digita o telefone e já cai no cliente */}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const tel = new FormData(e.currentTarget).get("tel")?.toString().replace(/\D/g, "") ?? "";
            router.push(`/pdv/${storeId}/nova${tel ? `?tel=${tel}` : ""}`);
          }}
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pdv-muted" aria-hidden />
            <input
              name="tel"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              aria-label="Telefone do cliente pra novo pedido"
              placeholder="Telefone do cliente"
              className="h-12 w-44 rounded-pdv-md border border-pdv-line-input bg-pdv-surface pr-3 pl-9 outline-none placeholder:text-pdv-muted focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40 sm:w-56"
            />
          </div>
          <PdvButton type="submit" variant="primary">
            Novo pedido
          </PdvButton>
        </form>
        <Link
          href={`/pdv/${storeId}/nova?balcao=1`}
          className="inline-flex h-12 items-center gap-2 rounded-pdv-md border border-pdv-balcao px-3 font-semibold text-pdv-balcao outline-none hover:bg-pdv-balcao/10 focus-visible:ring-3 focus-visible:ring-pdv-accent"
        >
          <Store className="size-5" aria-hidden /> <span className="hidden sm:inline">Balcão</span>
          <span className="sr-only sm:hidden">Balcão</span>
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
