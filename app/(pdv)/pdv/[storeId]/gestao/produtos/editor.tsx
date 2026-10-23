"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { brl, mascaraDinheiro, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { TIPOS_PRODUTO } from "@/lib/pdv-cardapio-preco";
import { cn } from "@/lib/utils";
import { salvarProdutoMae } from "../actions";

type Variacao = { id?: string; nome: string; recipeId: string | null; receitaNome?: string | null; precoReferencia: number | null };
type Produto = { id?: string; nome: string; tipo: string; ativo: boolean; variacoes: Variacao[] };
type Receita = { id: string; nome: string; tipo: string };

const NOVO: Produto = { nome: "", tipo: "PIZZA", ativo: true, variacoes: [{ nome: "G", recipeId: null, precoReferencia: null }] };

export function ProdutosEditor({ storeId, produtos, receitas }: { storeId: string; produtos: Produto[]; receitas: Receita[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | "novo" | null>(null);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? produtos.filter((p) => p.nome.toLowerCase().includes(q)) : produtos;
    return TIPOS_PRODUTO.map((t) => ({ ...t, produtos: lista.filter((p) => p.tipo === t.id) })).filter((g) => g.produtos.length);
  }, [busca, produtos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-pdv-display text-2xl font-extrabold">Produtos mãe</h1>
          <p className="text-sm text-pdv-muted">O que a casa produz, sem preço. Os cardápios apontam pra cá — e os relatórios também.</p>
        </div>
        <PdvButton variant="primary" className="ml-auto" onClick={() => setAberto("novo")}>
          <Plus /> Novo produto
        </PdvButton>
      </div>

      {aberto === "novo" ? <ProdutoForm storeId={storeId} inicial={NOVO} receitas={receitas} onFechar={() => setAberto(null)} /> : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pdv-muted" aria-hidden />
        <input
          type="search"
          aria-label="Buscar produto"
          placeholder="Buscar produto"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-12 w-full rounded-pdv-md border border-pdv-line-input bg-pdv-surface pr-3 pl-9 outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
        />
      </div>

      {grupos.length === 0 ? <p className="rounded-pdv-md border border-dashed border-pdv-line p-8 text-center text-pdv-muted">Nenhum produto.</p> : null}

      {grupos.map((g) => (
        <section key={g.id} aria-label={g.label} className="flex flex-col gap-1">
          <h2 className="px-1 font-pdv-display text-xs font-extrabold tracking-[.2em] text-pdv-accent uppercase">
            {g.label} · {g.produtos.length}
          </h2>
          <ul className="flex flex-col divide-y divide-pdv-line overflow-hidden rounded-pdv-lg bg-pdv-surface">
            {g.produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-expanded={aberto === p.id}
                  onClick={() => setAberto(aberto === p.id ? null : p.id!)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left outline-none hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-inset"
                >
                  <span className={cn("min-w-0 flex-1 font-semibold", !p.ativo && "line-through opacity-50")}>{p.nome}</span>
                  <span className="flex flex-wrap gap-1">
                    {p.variacoes.map((v) => (
                      <span key={v.id} className="rounded-full border border-pdv-line px-2 py-0.5 text-xs" title={v.receitaNome ? `ficha: ${v.receitaNome}` : "sem ficha técnica"}>
                        {v.nome}
                        {v.precoReferencia != null ? <span className="ml-1 font-mono text-pdv-muted">{brl(v.precoReferencia)}</span> : null}
                        {!v.recipeId ? <span className="ml-1 text-pdv-warning" aria-label="sem ficha técnica">•</span> : null}
                      </span>
                    ))}
                  </span>
                  <ChevronDown className={cn("size-4 text-pdv-muted transition-transform", aberto === p.id && "rotate-180")} aria-hidden />
                </button>
                {aberto === p.id ? (
                  <div className="border-t border-pdv-line p-3">
                    <ProdutoForm storeId={storeId} inicial={p} receitas={receitas} onFechar={() => setAberto(null)} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-pdv-muted"><span className="text-pdv-warning">•</span> = variação sem ficha técnica (não dá baixa no estoque nem calcula custo).</p>
    </div>
  );
}

function ProdutoForm({ storeId, inicial, receitas, onFechar }: { storeId: string; inicial: Produto; receitas: Receita[]; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [nome, setNome] = useState(inicial.nome);
  const [tipo, setTipo] = useState(inicial.tipo);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [vars, setVars] = useState(
    inicial.variacoes.map((v) => ({ id: v.id, nome: v.nome, recipeId: v.recipeId ?? "", preco: v.precoReferencia != null ? mascaraDinheiro(v.precoReferencia.toFixed(2)) : "" }))
  );
  const setVar = (i: number, p: Partial<(typeof vars)[number]>) => setVars((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const preset = (nomes: string[]) => setVars(nomes.map((n) => ({ nome: n, recipeId: "", preco: "", id: undefined })));

  function salvar() {
    start(async () => {
      const r = await salvarProdutoMae(storeId, {
        id: inicial.id,
        nome,
        tipo: tipo as "PIZZA",
        ativo,
        variacoes: vars.map((v) => ({ id: v.id, nome: v.nome, recipeId: v.recipeId || null, precoReferencia: v.preco ? parseValor(v.preco) : null })),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Produto salvo");
      onFechar();
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-pdv-md border border-pdv-line bg-pdv-bg p-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <PdvField label="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="ex: Calabresa" autoFocus={!inicial.id} />
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5 accent-[var(--pdv-accent)]" /> Ativo
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-pdv-muted uppercase">Tipo</legend>
        {TIPOS_PRODUTO.map((t) => (
          <label
            key={t.id}
            className={cn(
              "flex h-10 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
              tipo === t.id ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-muted"
            )}
          >
            <input type="radio" name={`tipo-${inicial.id ?? "novo"}`} className="sr-only" checked={tipo === t.id} onChange={() => setTipo(t.id)} />
            {t.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Variações (tamanhos)</span>
          <span className="ml-auto flex gap-1">
            <PdvButton size="sm" variant="ghost" onClick={() => preset(["P", "M", "G"])}>P/M/G</PdvButton>
            <PdvButton size="sm" variant="ghost" onClick={() => preset(["Unidade"])}>Unidade</PdvButton>
          </span>
        </div>
        {vars.map((v, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_7rem_auto] items-end gap-2">
            <PdvField label="Nome" value={v.nome} onChange={(e) => setVar(i, { nome: e.target.value })} maxLength={30} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Ficha técnica</span>
              <select
                value={v.recipeId}
                onChange={(e) => setVar(i, { recipeId: e.target.value })}
                className="h-12 min-w-0 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-2 text-sm outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
              >
                <option value="">— sem ficha —</option>
                {receitas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </label>
            <PdvField label="Preço ref." dinheiro placeholder="0,00" value={v.preco} onChange={(e) => setVar(i, { preco: e.target.value })} />
            <PdvButton size="icon" variant="ghost" disabled={vars.length === 1} onClick={() => setVars((l) => l.filter((_, j) => j !== i))} aria-label={`Remover variação ${v.nome || i + 1}`}>
              <Trash2 />
            </PdvButton>
          </div>
        ))}
        <PdvButton size="sm" onClick={() => setVars((l) => [...l, { nome: "", recipeId: "", preco: "", id: undefined }])} className="self-start">
          <Plus /> Variação
        </PdvButton>
        <p className="text-xs text-pdv-muted">Preço de referência = o preço “cheio”; serve de base ao montar cardápio e pra medir desconto de promoção.</p>
      </div>

      <div className="flex gap-2">
        <PdvButton type="submit" variant="primary" loading={pendente}>
          Salvar
        </PdvButton>
        <PdvButton variant="ghost" onClick={onFechar}>
          Cancelar
        </PdvButton>
      </div>
    </form>
  );
}
