"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronDown, ImageOff, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { brl, mascaraDinheiro, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { cn } from "@/lib/utils";
import { excluirCategoriaProduto, fotoDoProduto, salvarCategoriaProduto, salvarProdutoMae } from "../actions";

type Variacao = { id?: string; nome: string; recipeId: string | null; receitaNome?: string | null; precoReferencia: number | null };
type Produto = { id?: string; nome: string; categoriaId: string | null; descricao: string; temFoto: boolean; ativo: boolean; variacoes: Variacao[] };
type Categoria = { id: string; nome: string };
type Receita = { id: string; nome: string };

const SEM = "__sem";

export function ProdutosEditor({ storeId, produtos, categorias, receitas }: { storeId: string; produtos: Produto[]; categorias: Categoria[]; receitas: Receita[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | "novo" | null>(null);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? produtos.filter((p) => p.nome.toLowerCase().includes(q)) : produtos;
    const todas = [...categorias, { id: SEM, nome: "Sem categoria" }];
    return todas
      .filter((c) => !filtro || c.id === filtro)
      .map((c) => ({ ...c, produtos: lista.filter((p) => (p.categoriaId ?? SEM) === c.id) }))
      .filter((g) => g.produtos.length || (filtro === g.id && g.id !== SEM));
  }, [busca, produtos, categorias, filtro]);

  const novo: Produto = { nome: "", categoriaId: filtro && filtro !== SEM ? filtro : (categorias[0]?.id ?? null), descricao: "", temFoto: false, ativo: true, variacoes: [{ nome: "G", recipeId: null, precoReferencia: null }] };

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

      <Categorias storeId={storeId} categorias={categorias} produtos={produtos} filtro={filtro} onFiltro={setFiltro} />

      {aberto === "novo" ? <ProdutoForm storeId={storeId} inicial={novo} categorias={categorias} receitas={receitas} onFechar={() => setAberto(null)} /> : null}

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
        <section key={g.id} aria-label={g.nome} className="flex flex-col gap-1">
          <h2 className="px-1 font-pdv-display text-xs font-extrabold tracking-[.2em] text-pdv-accent uppercase">
            {g.nome} · {g.produtos.length}
          </h2>
          {g.produtos.length === 0 ? <p className="rounded-pdv-md border border-dashed border-pdv-line p-4 text-sm text-pdv-muted">Nenhum produto nessa categoria ainda.</p> : null}
          <ul className="flex flex-col divide-y divide-pdv-line overflow-hidden rounded-pdv-lg bg-pdv-surface">
            {g.produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-expanded={aberto === p.id}
                  onClick={() => setAberto(aberto === p.id ? null : p.id!)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left outline-none hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-inset"
                >
                  <span className={cn("min-w-0 flex-1", !p.ativo && "line-through opacity-50")}>
                    <span className="flex items-center gap-2 font-semibold">
                      {p.nome}
                      {p.temFoto ? <Camera className="size-4 text-pdv-muted" aria-label="tem foto" /> : null}
                    </span>
                    {p.descricao ? <span className="block truncate text-xs text-pdv-muted">{p.descricao}</span> : null}
                  </span>
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
                    <ProdutoForm storeId={storeId} inicial={p} categorias={categorias} receitas={receitas} onFechar={() => setAberto(null)} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-pdv-muted">
        <span className="text-pdv-warning">•</span> = variação sem ficha técnica (não dá baixa no estoque nem calcula custo).
      </p>
    </div>
  );
}

/** Faixa de categorias: filtra a lista e deixa criar, renomear e excluir. */
function Categorias({
  storeId,
  categorias,
  produtos,
  filtro,
  onFiltro,
}: {
  storeId: string;
  categorias: Categoria[];
  produtos: Produto[];
  filtro: string | null;
  onFiltro: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const conta = (id: string) => produtos.filter((p) => (p.categoriaId ?? SEM) === id).length;

  function rodar(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, depois?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(ok);
      depois?.();
      router.refresh();
    });
  }

  const chip = "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent";

  return (
    <section aria-label="Categorias de produto" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Categorias</span>
        <button type="button" aria-pressed={!filtro} onClick={() => onFiltro(null)} className={cn(chip, !filtro ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-muted")}>
          Todas <span className="font-mono text-xs opacity-80">{produtos.length}</span>
        </button>
        {categorias.map((c) =>
          editando?.id === c.id ? (
            <form
              key={c.id}
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                rodar(() => salvarCategoriaProduto(storeId, { id: c.id, nome: editando.nome }), "Categoria renomeada", () => setEditando(null));
              }}
            >
              <input
                autoFocus
                aria-label={`Novo nome de ${c.nome}`}
                value={editando.nome}
                onChange={(e) => setEditando({ id: c.id, nome: e.target.value })}
                maxLength={40}
                className="h-10 w-36 rounded-full border border-pdv-accent bg-pdv-bg px-3 text-sm outline-none"
              />
              <PdvButton size="icon" variant="ghost" type="submit" aria-label="Salvar nome" disabled={pendente}>
                <Check />
              </PdvButton>
              <PdvButton
                size="icon"
                variant="ghost"
                aria-label={`Excluir categoria ${c.nome}`}
                disabled={pendente}
                onClick={() =>
                  confirm(`Excluir a categoria ${c.nome}? Os ${conta(c.id)} produtos dela ficam sem categoria.`) &&
                  rodar(() => excluirCategoriaProduto(storeId, c.id), "Categoria excluída", () => {
                    setEditando(null);
                    if (filtro === c.id) onFiltro(null);
                  })
                }
              >
                <Trash2 />
              </PdvButton>
              <PdvButton size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditando(null)}>
                <X />
              </PdvButton>
            </form>
          ) : (
            <span key={c.id} className="flex items-center">
              <button
                type="button"
                aria-pressed={filtro === c.id}
                onClick={() => onFiltro(filtro === c.id ? null : c.id)}
                className={cn(chip, filtro === c.id ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-text hover:border-pdv-line-input")}
              >
                {c.nome} <span className="font-mono text-xs opacity-70">{conta(c.id)}</span>
              </button>
              <button
                type="button"
                aria-label={`Renomear ou excluir ${c.nome}`}
                onClick={() => setEditando({ id: c.id, nome: c.nome })}
                className="grid size-8 place-items-center rounded-full text-pdv-muted outline-none hover:text-pdv-text focus-visible:ring-3 focus-visible:ring-pdv-accent"
              >
                <Pencil className="size-3.5" />
              </button>
            </span>
          )
        )}
        {conta(SEM) ? (
          <button type="button" aria-pressed={filtro === SEM} onClick={() => onFiltro(filtro === SEM ? null : SEM)} className={cn(chip, filtro === SEM ? "border-pdv-warning bg-pdv-warning text-pdv-on-accent" : "border-dashed border-pdv-warning text-pdv-warning")}>
            Sem categoria <span className="font-mono text-xs opacity-80">{conta(SEM)}</span>
          </button>
        ) : null}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          rodar(() => salvarCategoriaProduto(storeId, { nome: nova }), "Categoria criada", () => setNova(""));
        }}
      >
        <input
          aria-label="Nova categoria"
          placeholder="Nova categoria (ex: Bordas, Adicionais)"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          maxLength={40}
          className="h-10 min-w-0 flex-1 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-3 text-sm outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40 sm:max-w-xs"
        />
        <PdvButton size="sm" type="submit" disabled={nova.trim().length < 2} loading={pendente}>
          <Plus /> Criar
        </PdvButton>
      </form>
    </section>
  );
}

/** Reduz a foto no navegador (lado maior 600px, JPEG) antes de salvar no banco. */
function reduzirFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
    img.onload = () => {
      const escala = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("Não foi possível processar a imagem"));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.src = URL.createObjectURL(file);
  });
}

function ProdutoForm({ storeId, inicial, categorias, receitas, onFechar }: { storeId: string; inicial: Produto; categorias: Categoria[]; receitas: Receita[]; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [nome, setNome] = useState(inicial.nome);
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial.categoriaId);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [ativo, setAtivo] = useState(inicial.ativo);
  // undefined = foto ainda não carregada/não mexida; null = sem foto
  const [foto, setFoto] = useState<string | null | undefined>(inicial.temFoto ? undefined : null);
  const [fotoMexida, setFotoMexida] = useState(false);
  const [vars, setVars] = useState(
    inicial.variacoes.map((v) => ({ id: v.id, nome: v.nome, recipeId: v.recipeId ?? "", preco: v.precoReferencia != null ? mascaraDinheiro(v.precoReferencia.toFixed(2)) : "" }))
  );
  const setVar = (i: number, p: Partial<(typeof vars)[number]>) => setVars((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const preset = (nomes: string[]) => setVars(nomes.map((n) => ({ nome: n, recipeId: "", preco: "", id: undefined })));

  useEffect(() => {
    if (!inicial.id || !inicial.temFoto) return;
    let vivo = true;
    fotoDoProduto(storeId, inicial.id).then((f) => vivo && setFoto((atual) => (atual === undefined ? f : atual)));
    return () => {
      vivo = false;
    };
  }, [storeId, inicial.id, inicial.temFoto]);

  async function escolherFoto(file: File | undefined) {
    if (!file) return;
    try {
      setFoto(await reduzirFoto(file));
      setFotoMexida(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function salvar() {
    start(async () => {
      const r = await salvarProdutoMae(storeId, {
        id: inicial.id,
        nome,
        categoriaId,
        descricao: descricao || undefined,
        fotoUrl: fotoMexida ? (foto ?? null) : undefined,
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
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        {/* foto */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Foto</span>
          <label className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-pdv-md border border-dashed border-pdv-line-input bg-pdv-surface text-pdv-muted has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent hover:border-pdv-accent">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={`Foto de ${nome || "produto"}`} className="size-full object-cover" />
            ) : foto === undefined ? (
              <span className="text-xs">carregando…</span>
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs">
                <Camera className="size-6" aria-hidden /> Adicionar
              </span>
            )}
            <input type="file" accept="image/*" className="sr-only" aria-label="Escolher foto" onChange={(e) => escolherFoto(e.target.files?.[0])} />
          </label>
          {foto ? (
            <button
              type="button"
              onClick={() => {
                setFoto(null);
                setFotoMexida(true);
              }}
              className="flex items-center gap-1 self-start rounded-pdv-sm px-1 text-xs text-pdv-danger outline-none hover:underline focus-visible:ring-3 focus-visible:ring-pdv-accent"
            >
              <ImageOff className="size-3.5" aria-hidden /> Tirar foto
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <PdvField label="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="ex: Calabresa" autoFocus={!inicial.id} />
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-5 accent-[var(--pdv-accent)]" /> Ativo
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="ex: Molho de tomate, mussarela, calabresa fatiada e cebola"
              className="rounded-pdv-sm border border-pdv-line-input bg-pdv-bg p-3 text-sm outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
            />
          </label>
        </div>
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-pdv-muted uppercase">Categoria</legend>
        {[...categorias, { id: "", nome: "Sem categoria" }].map((c) => {
          const marcado = (categoriaId ?? "") === c.id;
          return (
            <label
              key={c.id || "sem"}
              className={cn(
                "flex h-10 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
                marcado ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-muted"
              )}
            >
              <input type="radio" name={`cat-${inicial.id ?? "novo"}`} className="sr-only" checked={marcado} onChange={() => setCategoriaId(c.id || null)} />
              {c.nome}
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Variações (tamanhos)</span>
          <span className="ml-auto flex gap-1">
            <PdvButton size="sm" variant="ghost" onClick={() => preset(["P", "M", "G"])}>
              P/M/G
            </PdvButton>
            <PdvButton size="sm" variant="ghost" onClick={() => preset(["Unidade"])}>
              Unidade
            </PdvButton>
          </span>
        </div>
        {vars.map((v, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_7rem_auto] items-end gap-2">
            <PdvField label="Nome" value={v.nome} onChange={(e) => setVar(i, { nome: e.target.value })} maxLength={30} />
            <label className="flex min-w-0 flex-col gap-1.5">
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
