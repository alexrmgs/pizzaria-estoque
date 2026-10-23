"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { brl, PdvButton } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import type { ItemVenda, SaborOpcao } from "@/lib/pdv-cardapio";
import { precoMontavel } from "@/lib/pdv-cardapio-preco";

/** Janela do meio a meio: escolhe de 1 até N sabores; mostra o preço pela regra do item. */
export function EscolherSabores({
  item,
  onFechar,
  onConfirmar,
}: {
  item: ItemVenda;
  onFechar: () => void;
  onConfirmar: (sabores: SaborOpcao[]) => void;
}) {
  const [escolhidos, setEscolhidos] = useState<SaborOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? item.sabores.filter((s) => s.nome.toLowerCase().includes(q)) : item.sabores;
  }, [busca, item.sabores]);

  const cheio = escolhidos.length >= item.maxSabores;
  const preco = precoMontavel(item.regraPreco, escolhidos.map((s) => s.preco));

  function alternar(s: SaborOpcao) {
    setEscolhidos((e) => (e.some((x) => x.variacaoId === s.variacaoId) ? e.filter((x) => x.variacaoId !== s.variacaoId) : e.length >= item.maxSabores ? e : [...e, s]));
  }

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      aria-labelledby="sab-h"
      className="pdv m-auto flex max-h-[90dvh] w-[min(720px,95vw)] flex-col gap-3 rounded-pdv-lg border border-pdv-line bg-pdv-surface p-4 text-pdv-text shadow-pdv-pop backdrop:bg-black/70"
    >
      <div className="flex items-center gap-2">
        <h2 id="sab-h" className="font-pdv-display text-lg font-extrabold">
          {item.nome} — escolha até {item.maxSabores} sabores
        </h2>
        <PdvButton size="icon" variant="ghost" className="ml-auto" onClick={() => ref.current?.close()} aria-label="Fechar">
          <X />
        </PdvButton>
      </div>
      <p className="text-sm text-pdv-muted">Preço pelo {item.regraPreco === "MEDIA" ? "valor médio" : "sabor mais caro"} dos escolhidos.</p>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pdv-muted" aria-hidden />
        <input
          autoFocus
          type="search"
          aria-label="Buscar sabor"
          placeholder="Buscar sabor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-12 w-full rounded-pdv-md border border-pdv-line-input bg-pdv-bg pr-3 pl-9 outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
        />
      </div>

      <ul className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3" aria-label="Sabores">
        {lista.map((s) => {
          const marcado = escolhidos.some((x) => x.variacaoId === s.variacaoId);
          return (
            <li key={s.variacaoId}>
              <button
                type="button"
                aria-pressed={marcado}
                disabled={!marcado && cheio}
                onClick={() => alternar(s)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-2 rounded-pdv-md border-2 p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent disabled:opacity-40",
                  marcado ? "border-pdv-accent bg-pdv-accent/15" : "border-pdv-line bg-pdv-bg hover:border-pdv-line-input"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block leading-tight font-semibold">{s.nome}</span>
                  <span className="font-mono text-xs text-pdv-muted">{brl(s.preco)}</span>
                </span>
                {marcado ? <Check className="size-5 text-pdv-accent" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
        {lista.length === 0 ? <li className="col-span-full p-6 text-center text-pdv-muted">Nenhum sabor.</li> : null}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-pdv-line pt-3">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          {escolhidos.length ? escolhidos.map((s) => (escolhidos.length > 1 ? `1/${escolhidos.length} ${s.nome}` : s.nome)).join(" · ") : "Nenhum sabor escolhido"}
        </p>
        <PdvButton variant="primary" size="lg" disabled={!escolhidos.length} onClick={() => onConfirmar(escolhidos)}>
          Adicionar {escolhidos.length ? brl(preco) : ""}
        </PdvButton>
      </div>
    </dialog>
  );
}
