"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { brl, mascaraDinheiro, parseValor, PdvButton, PdvField } from "@/components/pdv/primitives";
import { DIAS_SEMANA, TIPOS_PRODUTO } from "@/lib/pdv-cardapio-preco";
import { cn } from "@/lib/utils";
import { adicionarTodos, excluirCategoria, excluirItem, salvarCategoria, salvarItem } from "../../actions";

type Variacao = { id: string; nome: string; produto: string; tipo: string; precoReferencia: number | null };
type TipoItem = "SIMPLES" | "COMBO" | "MONTAVEL";
type Item = {
  id?: string;
  nome: string;
  descricao: string;
  preco: number;
  ordem: number;
  tipo: TipoItem;
  componentes: { variacaoId: string; qtd: number; rotulo?: string }[];
  maxSabores: number;
  saborTipo: string | null;
  saborVariacao: string | null;
  regraPreco: string;
};
type Categoria = { id?: string; nome: string; ordem: number; dias: number[]; horaInicio: string | null; horaFim: string | null; itens: Item[] };

const selectCls =
  "h-12 w-full min-w-0 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-2 text-sm outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40";
const dinheiroTxt = (n: number) => mascaraDinheiro(n.toFixed(2));

function resumoHorario(c: Categoria) {
  const dias = c.dias.length ? c.dias.map((d) => DIAS_SEMANA[d]).join(", ") : "todo dia";
  return c.horaInicio && c.horaFim ? `${dias} · ${c.horaInicio}–${c.horaFim}` : dias;
}

export function CardapioEditor({ storeId, cardapioId, categorias, variacoes }: { storeId: string; cardapioId: string; categorias: Categoria[]; variacoes: Variacao[] }) {
  const [editandoCat, setEditandoCat] = useState<string | "nova" | null>(categorias.length ? null : "nova");
  const [editandoItem, setEditandoItem] = useState<{ cat: string; item: string | "novo" } | null>(null);
  const [lote, setLote] = useState<string | null>(null);
  const router = useRouter();
  const [pendente, start] = useTransition();

  function acao(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {variacoes.length === 0 ? (
        <p className="rounded-pdv-md border border-pdv-warning p-3 text-sm">Cadastre primeiro os produtos mãe — os itens do cardápio apontam pra eles.</p>
      ) : null}

      {categorias.map((c) => (
        <section key={c.id} aria-label={c.nome} className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-3">
          {editandoCat === c.id ? (
            <CategoriaForm storeId={storeId} cardapioId={cardapioId} inicial={c} onFechar={() => setEditandoCat(null)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-pdv-display text-lg font-extrabold">{c.nome}</h2>
              <span className="flex items-center gap-1 text-xs text-pdv-muted">
                <Clock className="size-3.5" aria-hidden /> {resumoHorario(c)}
              </span>
              <span className="ml-auto flex flex-wrap gap-1">
                <PdvButton size="sm" variant="ghost" onClick={() => setEditandoCat(c.id!)} aria-label={`Editar categoria ${c.nome}`}>
                  <Pencil />
                </PdvButton>
                <PdvButton size="sm" variant="ghost" onClick={() => setLote(lote === c.id ? null : c.id!)}>
                  <ListPlus /> Vários de uma vez
                </PdvButton>
                <PdvButton size="sm" onClick={() => setEditandoItem({ cat: c.id!, item: "novo" })}>
                  <Plus /> Item
                </PdvButton>
                <PdvButton
                  size="sm"
                  variant="ghost"
                  disabled={pendente}
                  aria-label={`Excluir categoria ${c.nome}`}
                  onClick={() => confirm(`Excluir a categoria ${c.nome}?`) && acao(() => excluirCategoria(storeId, c.id!), "Categoria excluída")}
                >
                  <Trash2 />
                </PdvButton>
              </span>
            </div>
          )}

          {lote === c.id ? <AdicionarLote storeId={storeId} categoriaId={c.id!} variacoes={variacoes} onFechar={() => setLote(null)} /> : null}
          {editandoItem?.cat === c.id && editandoItem?.item === "novo" ? (
            <ItemForm storeId={storeId} categoriaId={c.id!} variacoes={variacoes} inicial={null} ordem={c.itens.length} onFechar={() => setEditandoItem(null)} />
          ) : null}

          {c.itens.length === 0 ? <p className="p-3 text-sm text-pdv-muted">Categoria vazia.</p> : null}
          <ul className="flex flex-col divide-y divide-pdv-line">
            {c.itens.map((it) =>
              editandoItem?.item === it.id ? (
                <li key={it.id} className="py-2">
                  <ItemForm storeId={storeId} categoriaId={c.id!} variacoes={variacoes} inicial={it} ordem={it.ordem} onFechar={() => setEditandoItem(null)} />
                </li>
              ) : (
                <li key={it.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => setEditandoItem({ cat: c.id!, item: it.id! })}
                    className="flex min-w-0 flex-1 flex-col rounded-pdv-sm px-1 text-left outline-none hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{it.nome}</span>
                      {it.tipo !== "SIMPLES" ? (
                        <span className="rounded-full border border-pdv-line px-2 text-[11px] font-bold text-pdv-muted uppercase">{it.tipo === "COMBO" ? "combo" : `até ${it.maxSabores} sabores`}</span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-pdv-muted">
                      {it.tipo === "MONTAVEL"
                        ? `sabores: ${TIPOS_PRODUTO.find((t) => t.id === it.saborTipo)?.label ?? it.saborTipo} ${it.saborVariacao} · preço pelo ${it.regraPreco === "MEDIA" ? "médio" : "maior"}`
                        : it.componentes.map((k) => `${k.qtd !== 1 ? `${k.qtd}× ` : ""}${k.rotulo}`).join(" + ")}
                    </span>
                  </button>
                  <span className="font-mono tabular-nums">{it.tipo === "MONTAVEL" ? "pelos sabores" : brl(it.preco)}</span>
                  <PdvButton
                    size="sm"
                    variant="ghost"
                    disabled={pendente}
                    aria-label={`Excluir ${it.nome}`}
                    onClick={() => confirm(`Tirar ${it.nome} do cardápio?`) && acao(() => excluirItem(storeId, it.id!), "Item removido")}
                  >
                    <Trash2 />
                  </PdvButton>
                </li>
              )
            )}
          </ul>
        </section>
      ))}

      {editandoCat === "nova" ? (
        <div className="rounded-pdv-lg bg-pdv-surface p-3">
          <CategoriaForm storeId={storeId} cardapioId={cardapioId} inicial={{ nome: "", ordem: categorias.length, dias: [], horaInicio: null, horaFim: null, itens: [] }} onFechar={() => setEditandoCat(null)} />
        </div>
      ) : (
        <PdvButton className="self-start" onClick={() => setEditandoCat("nova")}>
          <Plus /> Nova categoria
        </PdvButton>
      )}
    </div>
  );
}

function CategoriaForm({ storeId, cardapioId, inicial, onFechar }: { storeId: string; cardapioId: string; inicial: Categoria; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [nome, setNome] = useState(inicial.nome);
  const [dias, setDias] = useState<number[]>(inicial.dias);
  const [ini, setIni] = useState(inicial.horaInicio ?? "");
  const [fim, setFim] = useState(inicial.horaFim ?? "");
  const [ordem, setOrdem] = useState(String(inicial.ordem));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await salvarCategoria(storeId, { id: inicial.id, cardapioId, nome, dias, horaInicio: ini || null, horaFim: fim || null, ordem: Number(ordem) || 0 });
          if (!r.ok) return void toast.error(r.error);
          toast.success("Categoria salva");
          onFechar();
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <PdvField label="Categoria" placeholder="ex: Pizzas G, Promo de Terça" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus />
        <PdvField label="Ordem" inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value.replace(/\D/g, ""))} />
      </div>
      <fieldset className="flex flex-wrap items-center gap-1">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-pdv-muted uppercase">Aparece em (nenhum marcado = todo dia)</legend>
        {DIAS_SEMANA.map((d, i) => {
          const on = dias.includes(i);
          return (
            <label
              key={d}
              className={cn(
                "grid h-10 w-12 cursor-pointer place-items-center rounded-pdv-sm border text-sm font-semibold has-focus-visible:ring-3 has-focus-visible:ring-pdv-accent",
                on ? "border-pdv-accent bg-pdv-accent text-pdv-on-accent" : "border-pdv-line text-pdv-muted"
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setDias((x) => (on ? x.filter((y) => y !== i) : [...x, i]))} />
              {d}
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-end gap-2">
        <PdvField label="Das" type="time" value={ini} onChange={(e) => setIni(e.target.value)} className="w-32" />
        <PdvField label="Até" type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="w-32" />
        <p className="pb-3 text-xs text-pdv-muted">vazio = o dia todo</p>
      </div>
      <div className="flex gap-2">
        <PdvButton type="submit" variant="primary" loading={pendente}>
          Salvar categoria
        </PdvButton>
        <PdvButton variant="ghost" onClick={onFechar}>
          Cancelar
        </PdvButton>
      </div>
    </form>
  );
}

function VariacaoSelect({ variacoes, value, onChange, label }: { variacoes: Variacao[]; value: string; onChange: (id: string) => void; label: string }) {
  const grupos = useMemo(() => TIPOS_PRODUTO.map((t) => ({ ...t, vs: variacoes.filter((v) => v.tipo === t.id) })).filter((g) => g.vs.length), [variacoes]);
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        <option value="">— escolha o produto —</option>
        {grupos.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {g.vs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.produto} · {v.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function ItemForm({
  storeId,
  categoriaId,
  variacoes,
  inicial,
  ordem,
  onFechar,
}: {
  storeId: string;
  categoriaId: string;
  variacoes: Variacao[];
  inicial: Item | null;
  ordem: number;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [tipo, setTipo] = useState<TipoItem>(inicial?.tipo ?? "SIMPLES");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [preco, setPreco] = useState(inicial ? dinheiroTxt(inicial.preco) : "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [comps, setComps] = useState(inicial?.componentes.length ? inicial.componentes.map((k) => ({ variacaoId: k.variacaoId, qtd: String(k.qtd) })) : [{ variacaoId: "", qtd: "1" }]);
  const [saborTipo, setSaborTipo] = useState(inicial?.saborTipo ?? "PIZZA");
  const [saborVariacao, setSaborVariacao] = useState(inicial?.saborVariacao ?? "");
  const [maxSabores, setMaxSabores] = useState(inicial && inicial.maxSabores > 1 ? inicial.maxSabores : 2);
  const [regra, setRegra] = useState(inicial?.regraPreco ?? "MAIOR");

  const tamanhos = useMemo(() => [...new Set(variacoes.filter((v) => v.tipo === saborTipo).map((v) => v.nome))], [variacoes, saborTipo]);

  function escolherSimples(id: string) {
    setComps([{ variacaoId: id, qtd: "1" }]);
    const v = variacoes.find((x) => x.id === id);
    if (!v) return;
    if (!nome.trim()) setNome(["Padrão", "Unidade"].includes(v.nome) ? v.produto : `${v.produto} ${v.nome}`);
    if (!preco && v.precoReferencia != null) setPreco(dinheiroTxt(v.precoReferencia));
  }

  function salvar() {
    start(async () => {
      const r = await salvarItem(storeId, {
        id: inicial?.id,
        categoriaId,
        nome,
        descricao: descricao || undefined,
        preco: tipo === "MONTAVEL" ? 0 : parseValor(preco),
        ordem,
        tipo,
        componentes: tipo === "MONTAVEL" ? [] : comps.filter((k) => k.variacaoId).map((k) => ({ variacaoId: k.variacaoId, qtd: Number(k.qtd.replace(",", ".")) || 1 })),
        maxSabores: tipo === "MONTAVEL" ? maxSabores : undefined,
        saborTipo: tipo === "MONTAVEL" ? (saborTipo as "PIZZA") : undefined,
        saborVariacao: tipo === "MONTAVEL" ? saborVariacao : undefined,
        regraPreco: regra as "MAIOR",
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Item salvo");
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
      <div role="radiogroup" aria-label="Tipo de item" className="grid grid-cols-3 gap-1 rounded-pdv-md bg-pdv-surface p-1">
        {(
          [
            ["SIMPLES", "Simples", "1 produto"],
            ["COMBO", "Combo", "vários produtos"],
            ["MONTAVEL", "Meio a meio", "escolhe sabores"],
          ] as const
        ).map(([id, label, desc]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={tipo === id}
            onClick={() => setTipo(id)}
            className={cn(
              "flex flex-col items-center rounded-pdv-sm py-2 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent",
              tipo === id ? "bg-pdv-accent text-pdv-on-accent" : "text-pdv-muted hover:text-pdv-text"
            )}
          >
            {label}
            <span className="text-[11px] font-normal opacity-80">{desc}</span>
          </button>
        ))}
      </div>

      {tipo === "SIMPLES" ? <VariacaoSelect label="Produto mãe" variacoes={variacoes} value={comps[0]?.variacaoId ?? ""} onChange={escolherSimples} /> : null}

      {tipo === "COMBO" ? (
        <div className="flex flex-col gap-2">
          {comps.map((k, i) => (
            <div key={i} className="flex items-end gap-2">
              <PdvField label="Qtd" inputMode="decimal" value={k.qtd} onChange={(e) => setComps((l) => l.map((x, j) => (j === i ? { ...x, qtd: e.target.value } : x)))} className="w-20" />
              <VariacaoSelect label={`Produto ${i + 1}`} variacoes={variacoes} value={k.variacaoId} onChange={(id) => setComps((l) => l.map((x, j) => (j === i ? { ...x, variacaoId: id } : x)))} />
              <PdvButton size="icon" variant="ghost" disabled={comps.length === 1} onClick={() => setComps((l) => l.filter((_, j) => j !== i))} aria-label={`Remover produto ${i + 1}`}>
                <Trash2 />
              </PdvButton>
            </div>
          ))}
          <PdvButton size="sm" className="self-start" onClick={() => setComps((l) => [...l, { variacaoId: "", qtd: "1" }])}>
            <Plus /> Produto no combo
          </PdvButton>
        </div>
      ) : null}

      {tipo === "MONTAVEL" ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Sabores do tipo</span>
            <select value={saborTipo} onChange={(e) => { setSaborTipo(e.target.value); setSaborVariacao(""); }} className={selectCls}>
              {TIPOS_PRODUTO.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">No tamanho</span>
            <select value={saborVariacao} onChange={(e) => setSaborVariacao(e.target.value)} className={selectCls}>
              <option value="">— escolha —</option>
              {tamanhos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Até quantos</span>
            <select value={maxSabores} onChange={(e) => setMaxSabores(Number(e.target.value))} className={selectCls}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} sabores</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Preço pelo</span>
            <select value={regra} onChange={(e) => setRegra(e.target.value)} className={selectCls}>
              <option value="MAIOR">Sabor mais caro</option>
              <option value="MEDIA">Média dos sabores</option>
            </select>
          </label>
          <p className="text-xs text-pdv-muted sm:col-span-4">
            Os sabores e preços saem dos itens simples deste cardápio desse tipo e tamanho (ex: todas as pizzas G). Promo valendo no dia entra com o preço da promo.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <PdvField label="Nome no cardápio" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder={tipo === "MONTAVEL" ? "ex: Pizza G Meio a Meio" : "ex: Calabresa G"} />
        {tipo !== "MONTAVEL" ? <PdvField label="Preço" dinheiro placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} /> : null}
      </div>
      <PdvField label="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} />

      <div className="flex gap-2">
        <PdvButton type="submit" variant="primary" loading={pendente}>
          Salvar item
        </PdvButton>
        <PdvButton variant="ghost" onClick={onFechar}>
          Cancelar
        </PdvButton>
      </div>
    </form>
  );
}

function AdicionarLote({ storeId, categoriaId, variacoes, onFechar }: { storeId: string; categoriaId: string; variacoes: Variacao[]; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [tipo, setTipo] = useState("PIZZA");
  const tamanhos = useMemo(() => [...new Set(variacoes.filter((v) => v.tipo === tipo).map((v) => v.nome))], [variacoes, tipo]);
  const [tam, setTam] = useState("");
  const tamanho = tam || tamanhos[0] || "";
  const qtd = variacoes.filter((v) => v.tipo === tipo && v.nome === tamanho).length;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-pdv-md border border-dashed border-pdv-accent p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">Todos os produtos do tipo</span>
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setTam(""); }} className={selectCls}>
          {TIPOS_PRODUTO.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">No tamanho</span>
        <select value={tamanho} onChange={(e) => setTam(e.target.value)} className={selectCls}>
          {tamanhos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <PdvButton
        variant="primary"
        disabled={!tamanho || pendente}
        loading={pendente}
        onClick={() =>
          start(async () => {
            const r = await adicionarTodos(storeId, categoriaId, tipo, tamanho);
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.criados ? `${r.criados} itens adicionados com o preço de referência` : "Nada novo pra adicionar");
            onFechar();
            router.refresh();
          })
        }
      >
        Adicionar {qtd} {qtd === 1 ? "item" : "itens"}
      </PdvButton>
      <PdvButton variant="ghost" onClick={onFechar}>
        Cancelar
      </PdvButton>
      <p className="w-full text-xs text-pdv-muted">Entra com o preço de referência de cada produto — depois é só ajustar o que for diferente.</p>
    </div>
  );
}
