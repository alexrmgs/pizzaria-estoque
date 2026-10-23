import { ArrowRight, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { brl, Cronometro, MODULOS, ModuloTag, PdvButton, type Modulo } from "@/components/pdv/primitives";

// Cartões das telas do PDV: pedido (kanban), coluna de status, mesa,
// produto (lançamento) e KDS.

export type PedidoResumo = {
  numero: number;
  modulo: Modulo;
  cliente: string;
  endereco?: string;
  total: number;
  taxaEntrega?: number;
  minutosNoStatus: number;
  hora: string;
  entregador?: string;
};

export function PedidoCard({ pedido, onAbrir }: { pedido: PedidoResumo; onAbrir?: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "flex w-full flex-col gap-2 rounded-pdv-md border-l-4 bg-pdv-surface p-3 text-left shadow-pdv-card outline-none transition-colors hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent",
        MODULOS[pedido.modulo].border
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-pdv-display text-2xl leading-none font-extrabold">#{pedido.numero}</span>
        <Cronometro minutos={pedido.minutosNoStatus} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{pedido.cliente}</p>
        {pedido.endereco ? <p className="truncate text-sm text-pdv-muted">{pedido.endereco}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <ModuloTag modulo={pedido.modulo} />
        <span className="font-mono text-lg font-bold tabular-nums">{brl(pedido.total)}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-pdv-muted">
        <span>{pedido.hora}</span>
        {pedido.entregador ? <span>🛵 {pedido.entregador}</span> : pedido.taxaEntrega ? <span>entrega {brl(pedido.taxaEntrega)}</span> : null}
      </div>
    </button>
  );
}

export function StatusColuna({
  nome,
  cor,
  quantidade,
  children,
}: {
  nome: string;
  cor: string;
  quantidade: number;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label={`${nome}: ${quantidade} pedidos`} className="flex min-w-72 flex-1 flex-col gap-3 rounded-pdv-lg bg-pdv-bg/60 p-2">
      <header className="flex items-center gap-2 px-1 pt-1">
        <span className="size-2.5 rounded-full" style={{ background: cor }} aria-hidden />
        <h3 className="font-pdv-display text-sm font-extrabold tracking-wider uppercase">{nome}</h3>
        <span className="ml-auto rounded-full bg-pdv-raised px-2 font-mono text-xs font-bold">{quantidade}</span>
      </header>
      {quantidade === 0 ? (
        <p className="rounded-pdv-md border border-dashed border-pdv-line p-6 text-center text-sm text-pdv-muted">Nada aqui agora</p>
      ) : (
        children
      )}
    </section>
  );
}

export type EstadoMesa = "LIVRE" | "OCUPADA" | "CONTA" | "OCIOSA";

const ESTADO_MESA: Record<EstadoMesa, { label: string; className: string }> = {
  LIVRE: { label: "Livre", className: "border-pdv-line bg-pdv-surface text-pdv-muted" },
  OCUPADA: { label: "Ocupada", className: "border-pdv-mesa bg-pdv-mesa/15 text-pdv-text" },
  CONTA: { label: "Pediu a conta", className: "border-pdv-accent bg-pdv-accent text-pdv-on-accent" },
  OCIOSA: { label: "Parada", className: "border-pdv-warning bg-pdv-warning/10 text-pdv-text" },
};

export function MesaCard({
  numero,
  estado,
  total,
  pessoas,
  minutos,
  onAbrir,
}: {
  numero: number;
  estado: EstadoMesa;
  total?: number;
  pessoas?: number;
  minutos?: number;
  onAbrir?: () => void;
}) {
  const e = ESTADO_MESA[estado];
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Mesa ${numero}, ${e.label}${total ? `, ${brl(total)}` : ""}`}
      className={cn(
        "flex aspect-square flex-col justify-between rounded-pdv-md border-2 p-3 text-left outline-none transition-transform active:scale-[.98] focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pdv-bg",
        e.className
      )}
    >
      <span className="font-pdv-display text-3xl leading-none font-extrabold">{numero}</span>
      <span className="text-xs font-bold tracking-wide uppercase">{e.label}</span>
      {estado !== "LIVRE" ? (
        <span className="flex items-center justify-between font-mono text-sm tabular-nums">
          <span>{total != null ? brl(total) : ""}</span>
          <span className="flex items-center gap-1 opacity-80">
            {pessoas ? (
              <>
                <Users className="size-3.5" aria-hidden />
                {pessoas}
              </>
            ) : null}
            {minutos != null ? ` · ${minutos}min` : null}
          </span>
        </span>
      ) : null}
    </button>
  );
}

export function ProdutoTile({
  nome,
  preco,
  esgotado,
  quantidadeNoCarrinho,
  onEscolher,
}: {
  nome: string;
  preco: number;
  esgotado?: boolean;
  quantidadeNoCarrinho?: number;
  onEscolher?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      disabled={esgotado}
      className="relative flex min-h-22 flex-col justify-between gap-1 rounded-pdv-md border border-pdv-line bg-pdv-surface p-3 text-left outline-none transition-colors hover:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent disabled:opacity-40"
    >
      <span className="line-clamp-2 leading-tight font-semibold">{nome}</span>
      <span className="font-mono text-sm text-pdv-accent tabular-nums">{esgotado ? "Esgotado" : brl(preco)}</span>
      {quantidadeNoCarrinho ? (
        <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-pdv-accent font-mono text-sm font-bold text-pdv-on-accent" aria-label={`${quantidadeNoCarrinho} no pedido`}>
          {quantidadeNoCarrinho}
        </span>
      ) : null}
    </button>
  );
}

export type KdsItem = { nome: string; qtd: number; detalhes?: string[]; obs?: string; novo?: boolean; obsNova?: boolean };

export function KdsCard({
  numero,
  modulo,
  referencia,
  minutos,
  limiteMin = 20,
  itens,
  onPronto,
  onOcultar,
}: {
  numero: number;
  modulo: Modulo;
  referencia: string;
  minutos: number;
  limiteMin?: number;
  itens: KdsItem[];
  onPronto?: () => void;
  onOcultar?: () => void;
}) {
  const atrasado = minutos >= limiteMin;
  return (
    <article
      aria-label={`Pedido ${numero}${atrasado ? ", atrasado" : ""}`}
      className={cn("flex w-72 flex-col overflow-hidden rounded-pdv-md border-2 bg-pdv-surface", atrasado ? "border-pdv-danger" : "border-pdv-line")}
    >
      <header className={cn("flex items-center gap-2 px-3 py-2", atrasado ? "bg-pdv-danger text-pdv-on-accent" : "bg-pdv-raised")}>
        <span className="font-pdv-display text-2xl font-extrabold">#{numero}</span>
        <ModuloTag modulo={modulo} solid />
        <span className={cn("ml-auto font-mono font-bold tabular-nums", atrasado && "pdv-late")}>{minutos}min</span>
      </header>
      <p className="border-b border-pdv-line px-3 py-1.5 text-sm text-pdv-muted">{referencia}</p>
      <ul className="flex flex-col gap-2 p-3">
        {itens.map((it, i) => (
          <li key={i} className={cn("rounded-pdv-sm px-2 py-1", it.novo && "bg-pdv-warning text-pdv-on-accent")}>
            <p className="text-lg leading-tight font-bold">
              <span className="font-mono">{it.qtd}×</span> {it.nome}
              {it.novo ? <span className="ml-2 text-xs font-bold uppercase">novo</span> : null}
            </p>
            {it.detalhes?.map((d) => (
              <p key={d} className={cn("text-sm", it.novo ? "" : "text-pdv-muted")}>
                · {d}
              </p>
            ))}
            {it.obs ? (
              <p className={cn("mt-1 text-sm font-bold", it.novo ? "" : it.obsNova ? "text-pdv-accent" : "text-pdv-ficha")}>⚠ {it.obs}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <footer className="mt-auto flex gap-2 border-t border-pdv-line p-2">
        <PdvButton variant="ghost" size="icon" onClick={onOcultar} aria-label="Tirar da tela sem mudar status">
          <X />
        </PdvButton>
        <PdvButton variant="primary" className="flex-1" onClick={onPronto}>
          Pronto <ArrowRight />
        </PdvButton>
      </footer>
    </article>
  );
}
