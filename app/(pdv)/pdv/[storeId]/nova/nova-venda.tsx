"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Minus, Phone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProdutoTile } from "@/components/pdv/cards";
import { FormaPagamentoPicker, ValorComMotivo, type Forma } from "@/components/pdv/payment";
import { brl, ModuloTag, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { imprimirViaEmSegundoPlano } from "@/components/pdv/imprimir";
import { calcularTaxaEntrega, criarVenda, type ClienteEncontrado } from "../actions";
import { IdentificarCliente, type Identificacao } from "./entrega";

type Produto = { id: string; nome: string; preco: number };
type Categoria = { id: string; nome: string; produtos: Produto[] };
type Linha = { produto: Produto; qtd: number; obs: string };

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const cents = (v: number) => Math.round(v * 100);

export function NovaVenda({
  storeId,
  categorias,
  formas,
  inicial,
  balcaoDireto,
}: {
  storeId: string;
  categorias: Categoria[];
  formas: Forma[];
  inicial?: { telefone: string; cliente: ClienteEncontrado | null };
  balcaoDireto?: boolean;
}) {
  const router = useRouter();
  const [enviando, startTransition] = useTransition();
  const requestId = useRef(novoId());

  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  // etapa 1: quem é o cliente / onde entregar. null = ainda identificando.
  const [ident, setIdent] = useState<Identificacao | null>(balcaoDireto ? { modulo: "BALCAO", nome: "", telefone: "" } : null);
  const [taxa, setTaxa] = useState("");
  const [obsEntrega, setObsEntrega] = useState("");
  // resultado do cálculo por km: "calculando…", "7,8 km · faixa até 8 km" ou aviso
  const [infoTaxa, setInfoTaxa] = useState<{ texto: string; aviso?: boolean } | null>(null);
  const [cliente, setCliente] = useState("");
  const [desconto, setDesconto] = useState("");
  const [descontoMotivo, setDescontoMotivo] = useState("");
  const [formaId, setFormaId] = useState<string | null>(formas[0]?.id ?? null);
  const [trocoPara, setTrocoPara] = useState("");

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q) return categorias.flatMap((c) => c.produtos).filter((p) => p.nome.toLowerCase().includes(q));
    return categorias.find((c) => c.id === categoriaId)?.produtos ?? [];
  }, [busca, categoriaId, categorias]);

  const subtotal = carrinho.reduce((s, l) => s + cents(l.produto.preco) * l.qtd, 0) / 100;
  const descontoNum = parseValor(desconto);
  const ehDelivery = ident?.modulo === "DELIVERY";
  const endereco = ident?.modulo === "DELIVERY" ? ident.cliente.enderecos.find((e) => e.id === ident.enderecoId) : undefined;
  const taxaNum = ehDelivery ? parseValor(taxa) : 0;
  const total = Math.max(0, Math.round((subtotal + taxaNum - descontoNum) * 100) / 100);
  const forma = formas.find((f) => f.id === formaId);
  const ehDinheiro = forma?.tipo === "DINHEIRO";
  const trocoParaNum = parseValor(trocoPara);
  const troco = ehDinheiro && trocoParaNum > total ? trocoParaNum - total : 0;
  const qtdNoCarrinho = (id: string) => carrinho.find((l) => l.produto.id === id)?.qtd;

  function adicionar(p: Produto) {
    setCarrinho((c) => {
      const i = c.findIndex((l) => l.produto.id === p.id);
      if (i === -1) return [...c, { produto: p, qtd: 1, obs: "" }];
      return c.map((l, j) => (j === i ? { ...l, qtd: l.qtd + 1 } : l));
    });
  }
  function mudarQtd(id: string, delta: number) {
    setCarrinho((c) => c.flatMap((l) => (l.produto.id !== id ? [l] : l.qtd + delta <= 0 ? [] : [{ ...l, qtd: l.qtd + delta }])));
  }
  function mudarObs(id: string, obs: string) {
    setCarrinho((c) => c.map((l) => (l.produto.id === id ? { ...l, obs } : l)));
  }

  const erroTroco = ehDinheiro && trocoPara.trim() !== "" && trocoParaNum < total ? "Menor que o total" : undefined;
  const podeCobrar =
    carrinho.length > 0 && !!formaId && !erroTroco && !(descontoNum > 0 && !descontoMotivo.trim()) && descontoNum <= subtotal + taxaNum;

  function cobrar() {
    if (!podeCobrar || !formaId || !ident) return;
    startTransition(async () => {
      const r = await criarVenda(storeId, {
        clientRequestId: requestId.current,
        modulo: ident.modulo,
        clienteNome: (ident.modulo === "DELIVERY" ? ident.cliente.nome : ident.nome || cliente).trim() || undefined,
        telefone: ident.modulo === "DELIVERY" ? ident.cliente.telefone : undefined,
        endereco: endereco
          ? { id: endereco.id, logradouro: endereco.logradouro, numero: endereco.numero, bairro: endereco.bairro, complemento: endereco.complemento, referencia: endereco.referencia }
          : undefined,
        taxaEntrega: taxaNum,
        obsEntrega: ehDelivery ? obsEntrega.trim() || undefined : undefined,
        itens: carrinho.map((l) => ({ produtoId: l.produto.id, qtd: l.qtd, obs: l.obs.trim() || undefined })),
        desconto: descontoNum,
        descontoMotivo: descontoMotivo.trim() || undefined,
        pagamentos: [{ formaId, valor: total, trocoPara: ehDinheiro && trocoParaNum > 0 ? trocoParaNum : undefined }],
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Pedido #${r.numero} lançado`);
      requestId.current = novoId();
      imprimirViaEmSegundoPlano(r.vendaId);
      router.push(`/pdv/${storeId}`);
    });
  }

  if (!ident) {
    return (
      <IdentificarCliente
        storeId={storeId}
        inicial={inicial}
        onPronto={(id) => {
          setIdent(id);
          if (id.modulo === "DELIVERY") {
            const e = id.cliente.enderecos.find((x) => x.id === id.enderecoId);
            // enquanto calcula, deixa a última taxa usada nesse endereço
            setTaxa(e && e.taxaEntrega > 0 ? e.taxaEntrega.toFixed(2).replace(".", ",") : "");
            setInfoTaxa({ texto: "Calculando distância…" });
            calcularTaxaEntrega(storeId, id.enderecoId).then((r) => {
              if (!r.ok) return setInfoTaxa({ texto: r.error, aviso: true });
              const km = `${r.km.toFixed(1).replace(".", ",")} km${r.precisao === "bairro" ? " (pelo bairro)" : ""}`;
              if (r.semFaixas) return setInfoTaxa({ texto: `${km} · cadastre as faixas em Taxas`, aviso: true });
              if (r.taxa == null) return setInfoTaxa({ texto: `${km} · fora da área de entrega`, aviso: true });
              setTaxa(r.taxa.toFixed(2).replace(".", ","));
              setInfoTaxa({ texto: `${km} · taxa automática` });
            });
          }
        }}
      />
    );
  }

  return (
    <main className="grid flex-1 lg:grid-cols-[1fr_400px]">
      {/* Cardápio */}
      <section aria-label="Cardápio" className="flex min-w-0 flex-col gap-3 p-3 md:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-pdv-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            aria-label="Buscar produto"
            placeholder="Buscar produto… (Enter adiciona o primeiro)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visiveis[0]) {
                adicionar(visiveis[0]);
                setBusca("");
              }
            }}
            className="h-12 w-full rounded-pdv-md border border-pdv-line-input bg-pdv-surface pr-3 pl-11 text-base outline-none placeholder:text-pdv-muted focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
          />
        </div>

        {!busca ? (
          <div role="tablist" aria-label="Categorias" className="flex gap-2 overflow-x-auto pb-1">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === categoriaId}
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full border px-4 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent",
                  c.id === categoriaId ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line bg-pdv-surface text-pdv-muted hover:text-pdv-text"
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>
        ) : null}

        {categorias.length === 0 ? (
          <p className="rounded-pdv-md border border-dashed border-pdv-line p-8 text-center text-pdv-muted">
            Cardápio vazio. Cadastre preço de venda nas Receitas de pizza, esfiha e beirute — o PDV importa sozinho.
          </p>
        ) : visiveis.length === 0 ? (
          <p className="p-8 text-center text-pdv-muted">Nenhum produto com “{busca}”.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visiveis.map((p) => (
              <ProdutoTile key={p.id} nome={p.nome} preco={p.preco} quantidadeNoCarrinho={qtdNoCarrinho(p.id)} onEscolher={() => adicionar(p)} />
            ))}
          </div>
        )}
      </section>

      {/* Pedido + pagamento */}
      <aside aria-label="Pedido" className="flex flex-col gap-4 border-t border-pdv-line bg-pdv-surface/40 p-3 md:p-4 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <div className="flex flex-col gap-2 rounded-pdv-md bg-pdv-surface p-3">
          <div className="flex items-center gap-2">
            <ModuloTag modulo={ident.modulo} solid />
            <span className="ml-auto text-sm text-pdv-muted">{carrinho.reduce((s, l) => s + l.qtd, 0)} itens</span>
            <PdvButton size="sm" variant="ghost" onClick={() => setIdent(null)}>
              Trocar
            </PdvButton>
          </div>
          {ident.modulo === "DELIVERY" ? (
            <>
              <p className="text-lg font-semibold">{ident.cliente.nome}</p>
              <p className="flex items-center gap-2 text-sm text-pdv-muted">
                <Phone className="size-4" aria-hidden /> {ident.cliente.telefone}
              </p>
              {endereco ? (
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-pdv-delivery" aria-hidden /> {endereco.texto}
                </p>
              ) : null}
            </>
          ) : ident.nome ? (
            <p className="text-lg font-semibold">{ident.nome}</p>
          ) : null}
        </div>

        {ident.modulo === "DELIVERY" ? (
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <PdvField label="Taxa de entrega" inputMode="decimal" placeholder="0,00" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
              <PdvField label="Obs. pro entregador" value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} maxLength={300} placeholder="ex: interfone quebrado" />
            </div>
            {infoTaxa ? (
              <p className={cn("text-sm", infoTaxa.aviso ? "text-pdv-warning" : "text-pdv-muted")} aria-live="polite">
                {infoTaxa.texto}
              </p>
            ) : null}
          </div>
        ) : !ident.nome ? (
          <PdvField label="Nome pra chamar (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={80} />
        ) : null}

        {carrinho.length === 0 ? (
          <p className="rounded-pdv-md border border-dashed border-pdv-line p-6 text-center text-sm text-pdv-muted">Toque nos produtos pra montar o pedido</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {carrinho.map((l) => (
              <li key={l.produto.id} className="flex flex-col gap-2 rounded-pdv-md bg-pdv-surface p-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.produto.nome}</span>
                  <span className="font-mono text-sm tabular-nums">{brl((cents(l.produto.preco) * l.qtd) / 100)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <PdvButton size="icon" variant="ghost" onClick={() => mudarQtd(l.produto.id, -1)} aria-label={`Tirar um ${l.produto.nome}`}>
                    {l.qtd === 1 ? <Trash2 /> : <Minus />}
                  </PdvButton>
                  <span className="w-8 text-center font-mono text-lg font-bold tabular-nums" aria-live="polite">{l.qtd}</span>
                  <PdvButton size="icon" variant="ghost" onClick={() => mudarQtd(l.produto.id, 1)} aria-label={`Mais um ${l.produto.nome}`}>
                    <Plus />
                  </PdvButton>
                  <input
                    aria-label={`Observação de ${l.produto.nome}`}
                    placeholder="Observação"
                    value={l.obs}
                    maxLength={200}
                    onChange={(e) => mudarObs(l.produto.id, e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-pdv-sm border border-pdv-line bg-pdv-bg px-2 text-sm outline-none placeholder:text-pdv-muted focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <ValorComMotivo label="Desconto" valor={desconto} motivo={descontoMotivo} onValor={setDesconto} onMotivo={setDescontoMotivo} />
        <FormaPagamentoPicker formas={formas} valor={formaId} onChange={setFormaId} />
        {ehDinheiro ? (
          <div className="flex items-end gap-3">
            <PdvField label="Troco para" inputMode="decimal" placeholder="0,00" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} error={erroTroco} className="flex-1" />
            <p className="pb-3 text-sm text-pdv-muted" aria-live="polite">
              Troco: <span className="font-mono font-bold text-pdv-text">{brl(troco)}</span>
            </p>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 border-t border-pdv-line pt-3">
          {descontoNum > 0 || taxaNum > 0 ? (
            <p className="flex flex-wrap justify-between gap-x-3 text-sm text-pdv-muted">
              <span>Itens {brl(subtotal)}</span>
              {taxaNum > 0 ? <span>Entrega +{brl(taxaNum)}</span> : null}
              {descontoNum > 0 ? <span>Desconto −{brl(descontoNum)}</span> : null}
            </p>
          ) : null}

          <PdvButton variant="primary" size="lg" onClick={cobrar} disabled={!podeCobrar} loading={enviando}>
            Cobrar {brl(total)}
          </PdvButton>
        </div>
      </aside>
    </main>
  );
}
