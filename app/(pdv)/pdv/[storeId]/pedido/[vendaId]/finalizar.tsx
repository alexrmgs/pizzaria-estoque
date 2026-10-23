"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormaPagamentoPicker, type Forma } from "@/components/pdv/payment";
import { brl, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { finalizarVenda } from "../../actions";

type Linha = { formaId: string; valor: string; trocoPara: string };
const txt = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Conferência do pagamento ao finalizar: vem preenchido com o previsto no
 * lançamento; dá pra trocar a forma, dividir em várias e ajustar o troco.
 */
export function FinalizarPainel({
  storeId,
  vendaId,
  total,
  formas,
  previstos,
  aberto,
}: {
  storeId: string;
  vendaId: string;
  total: number;
  formas: Forma[];
  previstos: { formaId: string; valor: number; trocoPara: number | null }[];
  aberto: boolean;
}) {
  const router = useRouter();
  const [mostrar, setMostrar] = useState(aberto);
  const [pendente, start] = useTransition();
  const [linhas, setLinhas] = useState<Linha[]>(
    previstos.length
      ? previstos.map((p) => ({ formaId: p.formaId, valor: txt(p.valor), trocoPara: p.trocoPara ? txt(p.trocoPara) : "" }))
      : [{ formaId: formas[0]?.id ?? "", valor: txt(total), trocoPara: "" }]
  );

  const set = (i: number, p: Partial<Linha>) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const somaCents = linhas.reduce((s, l) => s + Math.round(parseValor(l.valor) * 100), 0);
  const faltaCents = Math.round(total * 100) - somaCents;
  const ehDinheiro = (id: string) => formas.find((f) => f.id === id)?.tipo === "DINHEIRO";
  const trocoInvalido = linhas.some((l) => ehDinheiro(l.formaId) && l.trocoPara.trim() && parseValor(l.trocoPara) < parseValor(l.valor));

  if (!mostrar) {
    return (
      <PdvButton variant="primary" size="lg" onClick={() => setMostrar(true)}>
        <CheckCheck /> Finalizar pedido
      </PdvButton>
    );
  }

  function finalizar() {
    start(async () => {
      const r = await finalizarVenda(
        storeId,
        vendaId,
        linhas.map((l) => ({
          formaId: l.formaId,
          valor: parseValor(l.valor),
          trocoPara: ehDinheiro(l.formaId) && parseValor(l.trocoPara) > 0 ? parseValor(l.trocoPara) : undefined,
        }))
      );
      if (!r.ok) return void toast.error(r.error);
      toast.success("Pedido finalizado — pagamento no caixa");
      router.push(`/pdv/${storeId}`);
    });
  }

  return (
    <section aria-labelledby="fin-h" className="flex flex-col gap-4 rounded-pdv-lg border-2 border-pdv-accent bg-pdv-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="fin-h" className="font-pdv-display text-lg font-extrabold">Finalizar: conferir pagamento</h2>
        <span className="font-mono text-lg font-bold">{brl(total)}</span>
      </div>

      {linhas.map((l, i) => {
        const troco = ehDinheiro(l.formaId) && parseValor(l.trocoPara) > parseValor(l.valor) ? parseValor(l.trocoPara) - parseValor(l.valor) : 0;
        return (
          <div key={i} className="flex flex-col gap-3 rounded-pdv-md bg-pdv-bg p-3">
            <FormaPagamentoPicker formas={formas} valor={l.formaId} onChange={(id) => set(i, { formaId: id })} legenda={linhas.length > 1 ? `Pagamento ${i + 1}` : "Como o cliente pagou"} nome={`forma-${i}`} />
            <div className="flex items-end gap-2">
              <PdvField label="Valor" inputMode="decimal" value={l.valor} onChange={(e) => set(i, { valor: e.target.value })} className="w-32" />
              {ehDinheiro(l.formaId) ? (
                <>
                  <PdvField
                    label="Troco para"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={l.trocoPara}
                    onChange={(e) => set(i, { trocoPara: e.target.value })}
                    error={l.trocoPara.trim() && parseValor(l.trocoPara) < parseValor(l.valor) ? "Menor que o valor" : undefined}
                    className="w-32"
                  />
                  <p className="pb-3 text-sm text-pdv-muted">
                    Troco <span className="font-mono font-bold text-pdv-text">{brl(troco)}</span>
                  </p>
                </>
              ) : null}
              {linhas.length > 1 ? (
                <PdvButton size="icon" variant="ghost" className="ml-auto" onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))} aria-label={`Remover pagamento ${i + 1}`}>
                  <Trash2 />
                </PdvButton>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <PdvButton
          onClick={() =>
            setLinhas((l) => [...l, { formaId: formas.find((f) => !l.some((x) => x.formaId === f.id))?.id ?? formas[0].id, valor: faltaCents > 0 ? txt(faltaCents / 100) : "", trocoPara: "" }])
          }
        >
          <Plus /> Dividir em outra forma
        </PdvButton>
        <p className={cn("ml-auto font-mono font-bold", faltaCents === 0 ? "text-pdv-success" : "text-pdv-warning")} aria-live="polite">
          {faltaCents === 0 ? "Bateu ✓" : faltaCents > 0 ? `Falta ${brl(faltaCents / 100)}` : `Sobra ${brl(-faltaCents / 100)}`}
        </p>
      </div>

      <PdvButton variant="primary" size="lg" onClick={finalizar} loading={pendente} disabled={faltaCents !== 0 || trocoInvalido || linhas.some((l) => !l.formaId)}>
        <CheckCheck /> Finalizar e receber
      </PdvButton>
    </section>
  );
}
