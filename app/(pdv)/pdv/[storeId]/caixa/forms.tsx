"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConferenciaCaixa, type LinhaConferencia } from "@/components/pdv/payment";
import { parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { abrirCaixa, fecharCaixa, movimentoCaixa } from "../actions";

export function AbrirCaixaForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [pendente, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4 rounded-pdv-lg border border-pdv-line bg-pdv-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await abrirCaixa(storeId, parseValor(valor));
          if (!r.ok) return void toast.error(r.error);
          toast.success("Caixa aberto");
          router.push(`/pdv/${storeId}/nova`);
        });
      }}
    >
      <h1 className="font-pdv-display text-2xl font-extrabold">Abrir caixa</h1>
      <PdvField label="Troco no início do turno" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
      <PdvButton type="submit" variant="primary" size="lg" loading={pendente}>
        Abrir caixa
      </PdvButton>
    </form>
  );
}

const TIPOS = [
  { id: "SANGRIA", label: "Sangria" },
  { id: "REFORCO", label: "Reforço" },
  { id: "DESPESA", label: "Despesa" },
] as const;

export function MovimentoCaixaForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["id"]>("SANGRIA");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendente, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-pdv-md bg-pdv-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await movimentoCaixa(storeId, { tipo, valor: parseValor(valor), motivo });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Lançado");
          setValor("");
          setMotivo("");
          router.refresh();
        });
      }}
    >
      <fieldset className="flex gap-2">
        <legend className="sr-only">Tipo</legend>
        {TIPOS.map((t) => (
          <label
            key={t.id}
            className={cn(
              "flex h-11 flex-1 cursor-pointer items-center justify-center rounded-pdv-sm border text-sm font-semibold has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
              tipo === t.id ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-muted"
            )}
          >
            <input type="radio" name="tipo" className="sr-only" checked={tipo === t.id} onChange={() => setTipo(t.id)} />
            {t.label}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <PdvField label="Valor" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        <PdvField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
      </div>
      <PdvButton type="submit" loading={pendente} disabled={!(parseValor(valor) > 0) || !motivo.trim()}>
        Lançar
      </PdvButton>
    </form>
  );
}

export function FecharCaixaForm({ storeId, linhas }: { storeId: string; linhas: LinhaConferencia[] }) {
  const router = useRouter();
  const [contado, setContado] = useState<Record<string, number>>({});
  const [obs, setObs] = useState("");
  const [pendente, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm("Fechar o caixa agora?")) return;
        start(async () => {
          const r = await fecharCaixa(storeId, contado, obs);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Caixa fechado");
          router.push(`/pdv/${storeId}/caixa?fechado=${r.caixaId}`);
        });
      }}
    >
      <ConferenciaCaixa linhas={linhas} onChange={setContado} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Observação</span>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
          maxLength={500}
          className="rounded-pdv-sm border border-pdv-line-input bg-pdv-bg p-3 text-base outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
        />
      </label>
      <PdvButton type="submit" variant="danger" size="lg" loading={pendente}>
        Fechar caixa
      </PdvButton>
    </form>
  );
}
