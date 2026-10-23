"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { mascaraDinheiro, parseValor, PdvButton } from "@/components/pdv/primitives";
import { salvarFaixas } from "../actions";

type Linha = { ateKm: string; taxa: string };
const txt = (n: number) => n.toFixed(2).replace(".", ",").replace(/,00$/, "");

export function FaixasForm({ storeId, inicial, sugestao }: { storeId: string; inicial: { ateKm: number; taxa: number }[]; sugestao: boolean }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>(inicial.map((f) => ({ ateKm: txt(f.ateKm), taxa: f.taxa.toFixed(2).replace(".", ",") })));
  const [pendente, start] = useTransition();

  const set = (i: number, p: Partial<Linha>) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const inputCls =
    "h-12 w-full rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-3 text-right font-mono outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await salvarFaixas(
            storeId,
            linhas.map((l) => ({ ateKm: parseValor(l.ateKm), taxa: parseValor(l.taxa) }))
          );
          if (!r.ok) return void toast.error(r.error);
          toast.success("Taxas salvas");
          router.refresh();
        });
      }}
    >
      {sugestao ? <p className="text-sm text-pdv-warning">Sugestão inicial — ajuste e clique em Salvar.</p> : null}
      <table className="w-full border-separate border-spacing-y-1">
        <thead className="text-left text-xs tracking-wide text-pdv-muted uppercase">
          <tr>
            <th className="font-semibold">Até (km)</th>
            <th className="font-semibold">Taxa (R$)</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              <td className="pr-2">
                <input aria-label={`Faixa ${i + 1}: até quantos km`} inputMode="decimal" value={l.ateKm} onChange={(e) => set(i, { ateKm: e.target.value })} className={inputCls} />
              </td>
              <td className="pr-2">
                <input aria-label={`Faixa ${i + 1}: taxa`} inputMode="numeric" value={l.taxa} onChange={(e) => set(i, { taxa: mascaraDinheiro(e.target.value) })} className={inputCls} />
              </td>
              <td>
                <PdvButton size="icon" variant="ghost" onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))} aria-label={`Remover faixa ${i + 1}`}>
                  <Trash2 />
                </PdvButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PdvButton onClick={() => setLinhas((l) => [...l, { ateKm: "", taxa: "" }])}>
        <Plus /> Adicionar faixa
      </PdvButton>
      <PdvButton type="submit" variant="primary" size="lg" loading={pendente}>
        Salvar
      </PdvButton>
    </form>
  );
}
