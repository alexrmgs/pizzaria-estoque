"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PdvButton, PdvField } from "@/components/pdv/primitives";
import { criarCardapio, usarCardapioNaLoja } from "../actions";

export function NovoCardapioForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState("PDV");
  const [pendente, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-pdv-lg border border-dashed border-pdv-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await criarCardapio(storeId, nome, canal);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/pdv/${storeId}/gestao/cardapios/${r.id}`);
        });
      }}
    >
      <PdvField label="Novo cardápio" placeholder="ex: iFood FB Pizzaria" value={nome} onChange={(e) => setNome(e.target.value)} className="min-w-48 flex-1" maxLength={60} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Canal</span>
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="h-12 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-2 outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40">
          <option value="PDV">PDV (balcão/delivery)</option>
          <option value="IFOOD">iFood</option>
          <option value="CARDAPIOWEB">CardápioWeb</option>
          <option value="OUTRO">Outro</option>
        </select>
      </label>
      <PdvButton type="submit" variant="primary" loading={pendente} disabled={nome.trim().length < 2}>
        <Plus /> Criar
      </PdvButton>
    </form>
  );
}

export function UsarNaLojaBotao({ storeId, cardapioId }: { storeId: string; cardapioId: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  return (
    <PdvButton
      size="sm"
      loading={pendente}
      onClick={() =>
        start(async () => {
          const r = await usarCardapioNaLoja(storeId, cardapioId);
          if (!r.ok) return void toast.error(r.error);
          toast.success("O PDV desta loja agora usa esse cardápio");
          router.refresh();
        })
      }
    >
      Usar no PDV desta loja
    </PdvButton>
  );
}
