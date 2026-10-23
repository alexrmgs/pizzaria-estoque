"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProdutoTile } from "@/components/pdv/cards";
import { FormaPagamentoPicker, ValorComMotivo, type Forma } from "@/components/pdv/payment";
import { brl, MODULOS, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { criarVenda } from "../actions";
import { ENTREGA_VAZIA, EntregaForm, enderecoEscolhido, type DadosEntrega } from "./entrega";

type Produto = { id: string; nome: string; preco: number };
type Categoria = { id: string; nome: string; produtos: Produto[] };
type Linha = { produto: Produto; qtd: number; obs: string };

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const cents = (v: number) => Math.round(v * 100);

/**
 * Imprime a via num iframe escondido — a tela já pode ir pro quadro sem
 * esperar o diálogo de impressão. O iframe fica no <body> (fora do React), então
 * sobrevive à navegação; some sozinho depois de imprimir.
 */
function imprimirViaEmSegundoPlano(vendaId: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:200px;border:0";
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  f.src = `/pdv-cupom/${vendaId}?imprimir=iframe`;
  const remover = () => f.remove();
  window.addEventListener("message", function ok(e) {
    if (e.data === `pdv-impresso:${vendaId}`) {
      window.removeEventListener("message", ok);
      setTimeout(remover, 1000);
    }
  });
  setTimeout(remover, 120_000);
  document.body.appendChild(f);
}

export function NovaVenda({ storeId, categorias, formas }: { storeId: string; categorias: Categoria[]; formas: Forma[] }) {
  const router = useRouter();
  const [enviando, startTransition] = useTransition();
  const requestId = useRef(novoId());

  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [modulo, setModulo] = useState<"BALCAO" | "DELIVERY">("BALCAO");
  const [entrega, setEntrega] = useState<DadosEntrega>(ENTREGA_VAZIA);
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
  const ehDelivery = modulo === "DELIVERY";
  const taxaNum = ehDelivery ? parseValor(entrega.taxa) : 0;
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
  const faltaEntrega = ehDelivery
    ? entrega.telefone.replace(/\D/g, "").length < 10
      ? "Falta o telefone com DDD"
      : !entrega.nome.trim()
        ? "Falta o nome do cliente"
        : !enderecoEscolhido(entrega)
          ? "Falta o endereço"
          : null
    : null;
  const podeCobrar =
    carrinho.length > 0 && !!formaId && !erroTroco && !faltaEntrega && !(descontoNum > 0 && !descontoMotivo.trim()) && descontoNum <= subtotal + taxaNum;

  function cobrar() {
    if (!podeCobrar || !formaId) return;
    startTransition(async () => {
      const r = await criarVenda(storeId, {
        clientRequestId: requestId.current,
        modulo,
        clienteNome: (ehDelivery ? entrega.nome : cliente).trim() || undefined,
        telefone: ehDelivery ? entrega.telefone : undefined,
        endereco: ehDelivery ? enderecoEscolhido(entrega) : undefined,
        taxaEntrega: taxaNum,
        obsEntrega: ehDelivery ? entrega.obs.trim() || undefined : undefined,
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
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Tipo de pedido" className="grid flex-1 grid-cols-2 gap-1 rounded-pdv-md bg-pdv-bg p-1">
            {(["BALCAO", "DELIVERY"] as const).map((m) => {
              const M = MODULOS[m];
              const Icon = M.icon;
              const ativo = modulo === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setModulo(m)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-pdv-sm text-sm font-bold uppercase outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent",
                    ativo ? cn(M.bg, "text-pdv-on-accent") : "text-pdv-muted hover:text-pdv-text"
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {M.label}
                </button>
              );
            })}
          </div>
          <span className="shrink-0 text-sm text-pdv-muted">{carrinho.reduce((s, l) => s + l.qtd, 0)} itens</span>
        </div>

        {ehDelivery ? (
          <EntregaForm storeId={storeId} dados={entrega} onChange={setEntrega} />
        ) : (
          <PdvField label="Nome pra chamar (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={80} />
        )}

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
          {faltaEntrega && carrinho.length > 0 ? <p className="text-sm text-pdv-warning">{faltaEntrega}</p> : null}
          <PdvButton variant="primary" size="lg" onClick={cobrar} disabled={!podeCobrar} loading={enviando}>
            Cobrar {brl(total)}
          </PdvButton>
        </div>
      </aside>
    </main>
  );
}
