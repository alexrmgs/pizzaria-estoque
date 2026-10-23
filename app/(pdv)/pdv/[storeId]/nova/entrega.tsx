"use client";

import { useState, useTransition } from "react";
import { MapPin, Phone, Plus } from "lucide-react";

import { PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { buscarCliente, type ClienteEncontrado, type EnderecoInput } from "../actions";

export type DadosEntrega = {
  telefone: string;
  nome: string;
  cliente: ClienteEncontrado | null;
  buscado: boolean;
  enderecoId: string | "novo";
  novo: Required<Omit<EnderecoInput, "id">>;
  taxa: string;
  obs: string;
};

export const ENTREGA_VAZIA: DadosEntrega = {
  telefone: "",
  nome: "",
  cliente: null,
  buscado: false,
  enderecoId: "novo",
  novo: { logradouro: "", numero: "", bairro: "", complemento: "", referencia: "" },
  taxa: "",
  obs: "",
};

const taxaTexto = (v: number) => (v > 0 ? v.toFixed(2).replace(".", ",") : "");

/** Endereço que vai pro servidor: o escolhido da lista ou o novo digitado. */
export function enderecoEscolhido(d: DadosEntrega): EnderecoInput | undefined {
  if (d.enderecoId !== "novo") {
    const e = d.cliente?.enderecos.find((x) => x.id === d.enderecoId);
    if (e) return { id: e.id, logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, complemento: e.complemento, referencia: e.referencia };
  }
  return d.novo.logradouro.trim() ? d.novo : undefined;
}

export function EntregaForm({ storeId, dados, onChange }: { storeId: string; dados: DadosEntrega; onChange: (d: DadosEntrega) => void }) {
  const [buscando, start] = useTransition();
  const [erroBusca, setErroBusca] = useState<string>();
  const set = (p: Partial<DadosEntrega>) => onChange({ ...dados, ...p });
  const setNovo = (p: Partial<DadosEntrega["novo"]>) => onChange({ ...dados, novo: { ...dados.novo, ...p } });

  function buscar() {
    const tel = dados.telefone.replace(/\D/g, "");
    if (tel.length < 8) return setErroBusca("Digite o telefone com DDD");
    setErroBusca(undefined);
    start(async () => {
      const c = await buscarCliente(storeId, tel);
      const primeiro = c?.enderecos[0];
      onChange({
        ...dados,
        cliente: c,
        buscado: true,
        telefone: c?.telefone ?? tel,
        nome: c?.nome ?? dados.nome,
        enderecoId: primeiro?.id ?? "novo",
        taxa: primeiro ? taxaTexto(primeiro.taxaEntrega) : dados.taxa,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <PdvField
          label="Telefone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(85) 9 9999-9999"
          value={dados.telefone}
          onChange={(e) => set({ telefone: e.target.value, buscado: false, cliente: null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          error={erroBusca}
          className="flex-1"
        />
        <PdvButton onClick={buscar} loading={buscando} aria-label="Buscar cliente pelo telefone">
          <Phone /> Buscar
        </PdvButton>
      </div>

      {dados.buscado ? (
        <p className="text-sm" aria-live="polite">
          {dados.cliente ? (
            <span className="text-pdv-success">
              Cliente da casa · {dados.cliente.ultimosPedidos} pedido{dados.cliente.ultimosPedidos === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-pdv-warning">Cliente novo: preencha nome e endereço</span>
          )}
        </p>
      ) : null}

      <PdvField label="Nome do cliente" value={dados.nome} onChange={(e) => set({ nome: e.target.value })} maxLength={80} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-pdv-muted uppercase">Endereço de entrega</legend>
        {dados.cliente?.enderecos.map((e) => (
          <label
            key={e.id}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-pdv-md border-2 p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
              dados.enderecoId === e.id ? "border-pdv-delivery bg-pdv-delivery/10" : "border-pdv-line bg-pdv-surface"
            )}
          >
            <input
              type="radio"
              name="endereco"
              className="sr-only"
              checked={dados.enderecoId === e.id}
              onChange={() => set({ enderecoId: e.id, taxa: taxaTexto(e.taxaEntrega) })}
            />
            <MapPin className="mt-0.5 size-4 shrink-0 text-pdv-delivery" aria-hidden />
            <span>{e.texto}</span>
          </label>
        ))}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-pdv-md border-2 p-3 text-sm font-semibold has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
            dados.enderecoId === "novo" ? "border-pdv-delivery bg-pdv-delivery/10" : "border-dashed border-pdv-line text-pdv-muted"
          )}
        >
          <input type="radio" name="endereco" className="sr-only" checked={dados.enderecoId === "novo"} onChange={() => set({ enderecoId: "novo" })} />
          <Plus className="size-4" aria-hidden /> Novo endereço
        </label>
        {dados.enderecoId === "novo" ? (
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <PdvField label="Rua" value={dados.novo.logradouro} onChange={(e) => setNovo({ logradouro: e.target.value })} maxLength={150} />
            <PdvField label="Nº" value={dados.novo.numero} onChange={(e) => setNovo({ numero: e.target.value })} maxLength={20} />
            <PdvField label="Bairro" value={dados.novo.bairro} onChange={(e) => setNovo({ bairro: e.target.value })} maxLength={80} />
            <PdvField label="Compl." value={dados.novo.complemento} onChange={(e) => setNovo({ complemento: e.target.value })} maxLength={120} />
            <PdvField label="Ponto de referência" value={dados.novo.referencia} onChange={(e) => setNovo({ referencia: e.target.value })} maxLength={150} className="col-span-2" />
          </div>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <PdvField label="Taxa de entrega" inputMode="decimal" placeholder="0,00" value={dados.taxa} onChange={(e) => set({ taxa: e.target.value })} />
        <PdvField label="Obs. pro entregador" value={dados.obs} onChange={(e) => set({ obs: e.target.value })} maxLength={300} placeholder="ex: interfone quebrado" />
      </div>
    </div>
  );
}
