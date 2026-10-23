"use client";

import { useRef, useState, useTransition } from "react";
import { MapPin, Phone, Plus, Store, UserPlus } from "lucide-react";

import { DddField, juntarTelefone, PdvButton, PdvField, separarTelefone } from "@/components/pdv/primitives";
import { buscarCliente, salvarCliente, type ClienteEncontrado, type EnderecoInput } from "../actions";

// Primeira etapa do pedido: telefone → cliente (cadastra se não existir) →
// onde entregar (ou retirar no balcão). Só depois abre a tela de itens.

export type Identificacao =
  | { modulo: "BALCAO"; nome: string; telefone: string }
  | { modulo: "DELIVERY"; cliente: ClienteEncontrado; enderecoId: string };

type NovoEndereco = Required<Omit<EnderecoInput, "id">>;
const END_VAZIO: NovoEndereco = { logradouro: "", numero: "", bairro: "", complemento: "", referencia: "" };

export function IdentificarCliente({
  storeId,
  inicial,
  onPronto,
}: {
  storeId: string;
  /** veio do campo de telefone do quadro: a busca já foi feita no servidor */
  inicial?: { telefone: string; cliente: ClienteEncontrado | null };
  onPronto: (id: Identificacao) => void;
}) {
  const ini = separarTelefone(inicial?.telefone ?? "");
  const [ddd, setDdd] = useState(ini.ddd);
  const [telefone, setTelefone] = useState(ini.numero);
  const [erro, setErro] = useState<string>();
  const [cliente, setCliente] = useState<ClienteEncontrado | null>(inicial?.cliente ?? null);
  // null = ainda não buscou; "novo" = número sem cadastro; "endereco" = cliente quer endereço novo
  const [cadastro, setCadastro] = useState<null | "novo" | "endereco" | "achou">(
    inicial ? (inicial.cliente ? (inicial.cliente.enderecos.length ? "achou" : "endereco") : "novo") : null
  );
  const [nome, setNome] = useState(inicial?.cliente?.nome ?? "");
  const [end, setEnd] = useState<NovoEndereco>(END_VAZIO);
  const [cep, setCep] = useState("");
  const [cepInfo, setCepInfo] = useState<{ texto: string; erro?: boolean } | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);

  // CEP completo → busca rua e bairro no ViaCEP (grátis, sem chave)
  async function buscarCep(valor: string) {
    const d = valor.replace(/\D/g, "").slice(0, 8);
    setCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);
    if (d.length !== 8) return setCepInfo(null);
    setCepInfo({ texto: "Buscando CEP…" });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) });
      const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (j.erro) return setCepInfo({ texto: "CEP não encontrado — preencha a rua", erro: true });
      setEnd((e) => ({ ...e, logradouro: j.logradouro || e.logradouro, bairro: j.bairro || e.bairro }));
      setCepInfo({ texto: `${j.localidade}/${j.uf}${j.logradouro ? "" : " — CEP geral da cidade, preencha a rua"}` });
      numeroRef.current?.focus();
    } catch {
      setCepInfo({ texto: "Não consegui buscar o CEP agora — preencha a rua", erro: true });
    }
  }
  const [pendente, start] = useTransition();

  function buscar() {
    if (telefone.replace(/\D/g, "").length < 8) return setErro("Digite o telefone");
    if (ddd.length !== 2) return setErro("DDD com 2 dígitos");
    const digitos = juntarTelefone(ddd, telefone);
    setErro(undefined);
    start(async () => {
      const c = await buscarCliente(storeId, digitos);
      setCliente(c);
      setNome(c?.nome ?? "");
      setEnd(END_VAZIO);
      setCep("");
      setCepInfo(null);
      setCadastro(c ? (c.enderecos.length ? "achou" : "endereco") : "novo");
    });
  }

  function cadastrar() {
    start(async () => {
      const r = await salvarCliente(storeId, { telefone: cliente?.telefone ?? juntarTelefone(ddd, telefone), nome, endereco: end });
      if (!r.ok) return setErro(r.error);
      onPronto({ modulo: "DELIVERY", cliente: r.cliente, enderecoId: r.enderecoId! });
    });
  }

  const telDigitos = cliente?.telefone ?? juntarTelefone(ddd, telefone);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-4 md:p-8">
      <h1 className="font-pdv-display text-2xl font-extrabold">Novo pedido</h1>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <DddField
          value={ddd}
          onChange={(v) => {
            setDdd(v);
            setCadastro(null);
            setCliente(null);
          }}
        />
        <PdvField
          autoFocus={!inicial}
          label="Telefone do cliente"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="9 9999-9999"
          value={telefone}
          onChange={(e) => {
            setTelefone(e.target.value);
            setCadastro(null);
            setCliente(null);
          }}
          error={cadastro === null ? erro : undefined}
          className="flex-1"
        />
        <PdvButton type="submit" variant="primary" loading={pendente && cadastro === null}>
          <Phone /> Buscar
        </PdvButton>
      </form>

      {cadastro === null ? (
        <PdvButton size="lg" onClick={() => onPronto({ modulo: "BALCAO", nome: "", telefone: "" })} className="border-pdv-balcao text-pdv-balcao">
          <Store /> Balcão sem cliente
        </PdvButton>
      ) : null}

      {cadastro === "achou" && cliente ? (
        <section aria-label="Cliente encontrado" className="flex flex-col gap-3">
          <div className="rounded-pdv-md bg-pdv-surface p-3">
            <p className="text-lg font-semibold">{cliente.nome}</p>
            <p className="text-sm text-pdv-success">
              Cliente da casa · {cliente.ultimosPedidos} pedido{cliente.ultimosPedidos === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Entregar onde?</p>
          {cliente.enderecos.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPronto({ modulo: "DELIVERY", cliente, enderecoId: e.id })}
              className="flex min-h-16 items-start gap-3 rounded-pdv-md border-2 border-pdv-line bg-pdv-surface p-3 text-left outline-none hover:border-pdv-delivery focus-visible:ring-3 focus-visible:ring-pdv-accent"
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-pdv-delivery" aria-hidden />
              <span className="flex-1">{e.texto}</span>
              {e.taxaEntrega > 0 ? <span className="font-mono text-sm text-pdv-muted">taxa {e.taxaEntrega.toFixed(2).replace(".", ",")}</span> : null}
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <PdvButton onClick={() => setCadastro("endereco")}>
              <Plus /> Outro endereço
            </PdvButton>
            <PdvButton onClick={() => onPronto({ modulo: "BALCAO", nome: cliente.nome, telefone: cliente.telefone })}>
              <Store /> Retira no balcão
            </PdvButton>
          </div>
        </section>
      ) : null}

      {cadastro === "novo" || cadastro === "endereco" ? (
        <form
          aria-label={cadastro === "novo" ? "Cadastrar cliente" : "Novo endereço"}
          className="flex flex-col gap-3 rounded-pdv-lg border border-pdv-line bg-pdv-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            cadastrar();
          }}
        >
          <p className="flex items-center gap-2 font-semibold">
            <UserPlus className="size-5 text-pdv-warning" aria-hidden />
            {cadastro === "novo" ? "Número não cadastrado — cadastre o cliente" : `Novo endereço pra ${cliente?.nome}`}
          </p>
          {cadastro === "novo" ? <PdvField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus /> : null}
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="col-span-2 flex items-end gap-3">
              <PdvField label="CEP" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => buscarCep(e.target.value)} className="w-36" autoFocus={cadastro === "endereco"} />
              {cepInfo ? (
                <p className={`pb-3 text-sm ${cepInfo.erro ? "text-pdv-warning" : "text-pdv-muted"}`} aria-live="polite">
                  {cepInfo.texto}
                </p>
              ) : (
                <p className="pb-3 text-sm text-pdv-muted">opcional — preenche rua e bairro</p>
              )}
            </div>
            <PdvField label="Rua" value={end.logradouro} onChange={(e) => setEnd({ ...end, logradouro: e.target.value })} maxLength={150} />
            <PdvField ref={numeroRef} label="Nº" value={end.numero} onChange={(e) => setEnd({ ...end, numero: e.target.value })} maxLength={20} />
            <PdvField label="Bairro" value={end.bairro} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} maxLength={80} />
            <PdvField label="Compl." value={end.complemento} onChange={(e) => setEnd({ ...end, complemento: e.target.value })} maxLength={120} />
            <PdvField label="Ponto de referência" value={end.referencia} onChange={(e) => setEnd({ ...end, referencia: e.target.value })} maxLength={150} className="col-span-2" />
          </div>
          {erro ? (
            <p role="alert" className="text-sm text-pdv-danger">
              {erro}
            </p>
          ) : null}
          <PdvButton type="submit" variant="primary" size="lg" loading={pendente} disabled={!nome.trim() || !end.logradouro.trim()}>
            Cadastrar e fazer o pedido
          </PdvButton>
          {cadastro === "novo" ? (
            <PdvButton
              variant="ghost"
              disabled={!nome.trim()}
              onClick={() => onPronto({ modulo: "BALCAO", nome: nome.trim(), telefone: telDigitos })}
            >
              <Store /> Sem endereço, retira no balcão
            </PdvButton>
          ) : (
            <PdvButton variant="ghost" onClick={() => setCadastro("achou")}>
              Voltar pros endereços
            </PdvButton>
          )}
        </form>
      ) : null}
    </main>
  );
}
