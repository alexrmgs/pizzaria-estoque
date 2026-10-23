"use client";

import { useState } from "react";
import { Banknote, CreditCard, QrCode, Wallet, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { brl, parseValor, PdvField } from "@/components/pdv/primitives";

// Partes de pagamento e caixa do PDV.

export type TipoForma = "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "PIX" | "OUTRO";

const ICONE_FORMA: Record<TipoForma, LucideIcon> = {
  DINHEIRO: Banknote,
  CARTAO_CREDITO: CreditCard,
  CARTAO_DEBITO: CreditCard,
  PIX: QrCode,
  OUTRO: Wallet,
};

export type Forma = { id: string; nome: string; tipo: TipoForma };

/** Grade de formas de pagamento — radio de verdade (setas do teclado funcionam). */
export function FormaPagamentoPicker({
  formas,
  valor,
  onChange,
}: {
  formas: Forma[];
  valor: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-pdv-muted uppercase">Forma de pagamento</legend>
      {formas.map((f) => {
        const Icon = ICONE_FORMA[f.tipo];
        const ativo = valor === f.id;
        return (
          <label
            key={f.id}
            className={cn(
              "flex h-16 cursor-pointer items-center gap-2 rounded-pdv-md border-2 px-3 font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
              ativo ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line bg-pdv-surface hover:border-pdv-line-input"
            )}
          >
            <input type="radio" name="forma" value={f.id} checked={ativo} onChange={() => onChange(f.id)} className="sr-only" />
            <Icon className="size-5" aria-hidden />
            {f.nome}
          </label>
        );
      })}
    </fieldset>
  );
}

/** Desconto/acréscimo: valor + motivo obrigatório quando há valor. */
export function ValorComMotivo({ label, valor, motivo, onValor, onMotivo }: {
  label: string;
  valor: string;
  motivo: string;
  onValor: (v: string) => void;
  onMotivo: (v: string) => void;
}) {
  const temValor = Number(valor.replace(",", ".")) > 0;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <PdvField label={label} inputMode="decimal" value={valor} onChange={(e) => onValor(e.target.value)} placeholder="0,00" />
      <PdvField
        label="Motivo"
        value={motivo}
        onChange={(e) => onMotivo(e.target.value)}
        disabled={!temValor}
        error={temValor && !motivo.trim() ? "Diga o motivo" : undefined}
      />
    </div>
  );
}

export type PagamentoParcial = { forma: string; valor: number };

/** Lista de pagamentos já lançados + quanto falta. */
export function PagamentosParciais({ total, pagamentos, onRemover }: {
  total: number;
  pagamentos: PagamentoParcial[];
  onRemover?: (i: number) => void;
}) {
  const pago = pagamentos.reduce((s, p) => s + p.valor, 0);
  const falta = Math.max(0, Math.round((total - pago) * 100) / 100);
  return (
    <div className="flex flex-col gap-2 rounded-pdv-md bg-pdv-surface p-3">
      {pagamentos.length === 0 ? <p className="text-sm text-pdv-muted">Nenhum pagamento lançado</p> : null}
      {pagamentos.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span>{p.forma}</span>
          <span className="ml-auto font-mono tabular-nums">{brl(p.valor)}</span>
          {onRemover ? (
            <button type="button" onClick={() => onRemover(i)} className="rounded-pdv-sm px-2 text-sm text-pdv-danger hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent outline-none">
              remover
            </button>
          ) : null}
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-pdv-line pt-2" aria-live="polite">
        <span className="font-pdv-display text-sm font-extrabold tracking-wider uppercase">{falta > 0 ? "Falta" : "Quitado"}</span>
        <span className={cn("font-mono text-2xl font-bold tabular-nums", falta > 0 ? "text-pdv-accent" : "text-pdv-success")}>{brl(falta)}</span>
      </div>
    </div>
  );
}

export type LinhaConferencia = { id?: string; forma: string; esperado: number };

/** Fechamento de caixa: esperado x contado por forma. `cego` esconde o esperado. */
export function ConferenciaCaixa({
  linhas,
  cego,
  onChange,
}: {
  linhas: LinhaConferencia[];
  cego?: boolean;
  /** valores digitados, por `id` da linha (ou nome da forma, se não tiver id) */
  onChange?: (valores: Record<string, number>) => void;
}) {
  const [contado, setContado] = useState<Record<string, string>>({});
  const num = (s?: string) => parseValor(s ?? "");
  const atualizar = (chave: string, texto: string) => {
    const novo = { ...contado, [chave]: texto };
    setContado(novo);
    onChange?.(Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, num(v)])));
  };
  return (
    <table className="w-full border-separate border-spacing-y-1 text-left">
      <thead className="text-xs tracking-wide text-pdv-muted uppercase">
        <tr>
          <th className="px-3 font-semibold">Forma</th>
          {cego ? null : <th className="px-3 text-right font-semibold">Esperado</th>}
          <th className="px-3 text-right font-semibold">Contado</th>
          {cego ? null : <th className="px-3 text-right font-semibold">Diferença</th>}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => {
          const chave = l.id ?? l.forma;
          const dif = Math.round((num(contado[chave]) - l.esperado) * 100) / 100;
          const preenchido = contado[chave] != null && contado[chave] !== "";
          return (
            <tr key={chave} className="bg-pdv-surface">
              <td className="rounded-l-pdv-sm px-3 py-2 font-semibold">{l.forma}</td>
              {cego ? null : <td className="px-3 text-right font-mono tabular-nums">{brl(l.esperado)}</td>}
              <td className={cn("px-3 py-2 text-right", cego && "rounded-r-pdv-sm")}>
                <input
                  aria-label={`Contado em ${l.forma}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={contado[chave] ?? ""}
                  onChange={(e) => atualizar(chave, e.target.value)}
                  className="h-11 w-32 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-2 text-right font-mono tabular-nums outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
                />
              </td>
              {cego ? null : (
                <td
                  className={cn(
                    "rounded-r-pdv-sm px-3 text-right font-mono font-bold tabular-nums",
                    !preenchido ? "text-pdv-muted" : dif === 0 ? "text-pdv-success" : dif > 0 ? "text-pdv-warning" : "text-pdv-danger"
                  )}
                >
                  {!preenchido ? "—" : dif === 0 ? "ok" : `${dif > 0 ? "sobra " : "falta "}${brl(Math.abs(dif))}`}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
