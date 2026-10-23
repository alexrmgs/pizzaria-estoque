import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { etapasDoPedido, horaFortaleza, requirePdv } from "@/lib/pdv";
import { brl, ModuloTag, type Modulo } from "@/components/pdv/primitives";
import { AtualizaSozinho } from "@/components/pdv/atualiza-sozinho";
import { PedidoAcoes } from "./acoes";
import { FinalizarPainel } from "./finalizar";

const EVENTO: Record<string, string> = { CRIADA: "Pedido lançado", STATUS: "Mudou pra", PAGA: "Finalizado (pagamento conferido)", CANCELADA: "Cancelado" };

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; vendaId: string }>;
  searchParams: Promise<{ finalizar?: string }>;
}) {
  const { storeId, vendaId } = await params;
  const { finalizar } = await searchParams;
  const { user, store } = await requirePdv(storeId);

  const venda = await prisma.pdvVenda.findFirst({
    where: { id: vendaId, storeId: store!.id },
    include: {
      status: true,
      cliente: { select: { telefone: true } },
      itens: { orderBy: { createdAt: "asc" } },
      pagamentos: { where: { estornadoEm: null }, include: { forma: true } },
      historico: { orderBy: { createdAt: "asc" }, include: { status: true, user: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  if (!venda) notFound();

  const [statusLoja, role, formas] = await Promise.all([
    prisma.pdvStatus.findMany({ where: { storeId: store!.id }, orderBy: { ordem: "asc" }, select: { id: true, nome: true, cor: true } }),
    prisma.role.findUnique({ where: { id: user.role.id }, select: { canGerenciarPdv: true } }),
    prisma.pdvFormaPagamento.findMany({ where: { companyId: store!.companyId, ativo: true }, orderBy: { ordem: "asc" } }),
  ]);
  const finalizada = venda.situacao === "PAGA";
  const idx = statusLoja.findIndex((s) => s.id === venda.statusId);
  const cancelada = venda.situacao === "CANCELADA";
  const n = (v: unknown) => Number(v);
  const etapas = etapasDoPedido(statusLoja, venda.historico, venda.statusId);
  const fimDoPedido = cancelada ? venda.canceladaEm : null;
  // quanto tempo ficou em cada status: até entrar no próximo (ou até agora, no atual)
  const duracao = (i: number) => {
    const ini = etapas[i].em;
    if (!ini) return null;
    const fim = etapas[i + 1]?.em ?? (etapas[i].atual ? (fimDoPedido ?? new Date()) : null);
    return fim ? Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 60_000)) : null;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 md:p-6">
      <AtualizaSozinho ms={15000} />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/pdv/${store!.id}`}
          className="grid size-11 place-items-center rounded-pdv-sm text-pdv-muted outline-none hover:bg-pdv-raised hover:text-pdv-text focus-visible:ring-3 focus-visible:ring-pdv-accent"
          aria-label="Voltar pro quadro"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-pdv-display text-3xl font-extrabold">#{venda.numero}</h1>
        <ModuloTag modulo={venda.modulo as Modulo} solid />
        {cancelada ? (
          <span className="rounded-full bg-pdv-danger px-3 py-1 text-xs font-bold text-pdv-on-accent uppercase">Cancelado</span>
        ) : venda.status ? (
          <span className="rounded-full border px-3 py-1 text-xs font-bold uppercase" style={{ borderColor: venda.status.cor, color: venda.status.cor }}>
            {venda.status.nome}
          </span>
        ) : null}
        <span className="ml-auto text-sm text-pdv-muted">
          {horaFortaleza(venda.createdAt)} · por {venda.createdBy.name}
        </span>
      </div>

      <PedidoAcoes
        storeId={store!.id}
        vendaId={venda.id}
        podeVoltar={!cancelada && idx > 0}
        podeAvancar={!cancelada && idx >= 0 && idx < statusLoja.length - 1}
        podeCancelar={!!role?.canGerenciarPdv && !cancelada}
      />

      <ol aria-label="Linha do tempo do pedido" className="grid gap-2 rounded-pdv-lg bg-pdv-surface p-3 sm:grid-flow-col sm:auto-cols-fr">
        {etapas.map((e, i) => {
          const min = duracao(i);
          const feito = !!e.em;
          return (
            <li
              key={e.id}
              aria-current={e.atual ? "step" : undefined}
              className={`flex items-center gap-3 rounded-pdv-md border-2 p-2 sm:flex-col sm:items-start sm:gap-1 ${
                e.atual ? "border-pdv-accent bg-pdv-accent/10" : feito ? "border-pdv-line" : "border-dashed border-pdv-line opacity-50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="size-2.5 rounded-full" style={{ background: feito ? statusLoja[i].cor : "transparent", border: `2px solid ${statusLoja[i].cor}` }} aria-hidden />
                {e.nome}
              </span>
              <span className="ml-auto font-mono text-sm tabular-nums sm:ml-0">
                {e.em ? horaFortaleza(e.em) : "—"}
                {min != null ? <span className="text-pdv-muted"> · {min}min{e.atual && !cancelada ? " até agora" : ""}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {venda.situacao === "ABERTA" ? (
        <FinalizarPainel
          storeId={store!.id}
          vendaId={venda.id}
          total={n(venda.total)}
          formas={formas.map((f) => ({ id: f.id, nome: f.nome, tipo: f.tipo as "DINHEIRO" }))}
          previstos={venda.pagamentos.map((p) => ({ formaId: p.formaId, valor: n(p.valor), trocoPara: p.trocoPara != null ? n(p.trocoPara) : null }))}
          aberto={finalizar === "1"}
        />
      ) : null}
      {finalizada && venda.fechadaEm ? (
        <p className="rounded-pdv-md border border-pdv-success p-3 text-sm">
          <strong className="text-pdv-success">Finalizado às {horaFortaleza(venda.fechadaEm)}</strong> — pagamento conferido e lançado no caixa.
        </p>
      ) : null}

      {cancelada && venda.cancelMotivo ? (
        <p className="rounded-pdv-md border border-pdv-danger p-3 text-sm">
          <strong className="text-pdv-danger">Motivo do cancelamento:</strong> {venda.cancelMotivo}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="itens-h" className="flex flex-col gap-3 rounded-pdv-lg bg-pdv-surface p-4">
          <h2 id="itens-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Itens</h2>
          <ul className="flex flex-col divide-y divide-pdv-line">
            {venda.itens.map((i) => (
              <li key={i.id} className={`flex gap-3 py-2 ${i.canceladoEm ? "line-through opacity-50" : ""}`}>
                <span className="w-10 font-mono font-bold tabular-nums">{n(i.qtd)}×</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{i.nome}</span>
                  {i.obs ? <span className="block text-sm text-pdv-ficha">⚠ {i.obs}</span> : null}
                </span>
                <span className="font-mono tabular-nums">{brl(n(i.total))}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-pdv-line pt-3 text-sm">
            <div className="flex justify-between text-pdv-muted"><dt>Itens</dt><dd className="font-mono">{brl(n(venda.subtotal))}</dd></div>
            {n(venda.taxaEntrega) > 0 ? (
              <div className="flex justify-between text-pdv-muted"><dt>Entrega</dt><dd className="font-mono">+{brl(n(venda.taxaEntrega))}</dd></div>
            ) : null}
            {n(venda.acrescimo) > 0 ? (
              <div className="flex justify-between text-pdv-muted"><dt>Acréscimo ({venda.acrescimoMotivo})</dt><dd className="font-mono">+{brl(n(venda.acrescimo))}</dd></div>
            ) : null}
            {n(venda.desconto) > 0 ? (
              <div className="flex justify-between text-pdv-muted"><dt>Desconto ({venda.descontoMotivo})</dt><dd className="font-mono">−{brl(n(venda.desconto))}</dd></div>
            ) : null}
            <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd className="font-mono">{brl(n(venda.total))}</dd></div>
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="cli-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
            <h2 id="cli-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Cliente</h2>
            <p className="text-lg font-semibold">{venda.clienteNome || "Sem nome (balcão)"}</p>
            {venda.cliente?.telefone ? (
              <a href={`tel:${venda.cliente.telefone}`} className="flex items-center gap-2 text-pdv-delivery underline-offset-4 hover:underline">
                <Phone className="size-4" aria-hidden /> {venda.cliente.telefone}
              </a>
            ) : null}
            {venda.enderecoTexto ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-1 size-4 shrink-0 text-pdv-delivery" aria-hidden /> {venda.enderecoTexto}
              </p>
            ) : null}
            {venda.obsEntrega ? <p className="text-sm text-pdv-warning">Obs: {venda.obsEntrega}</p> : null}
          </section>

          <section aria-labelledby="pag-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
            <h2 id="pag-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">
              {venda.situacao === "ABERTA" ? "Pagamento previsto" : "Pagamento"}
            </h2>
            {venda.pagamentos.length === 0 ? <p className="text-sm text-pdv-muted">Sem pagamento lançado</p> : null}
            {venda.pagamentos.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>
                  {p.forma.nome}
                  {p.trocoPara ? <span className="text-sm text-pdv-muted"> · troco p/ {brl(n(p.trocoPara))} (devolver {brl(n(p.trocoPara) - n(p.valor))})</span> : null}
                </span>
                <span className="font-mono tabular-nums">{brl(n(p.valor))}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="hist-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
            <h2 id="hist-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Histórico</h2>
            <ol className="flex flex-col gap-1 text-sm">
              {venda.historico.map((h) => (
                <li key={h.id} className="flex gap-2">
                  <span className="w-12 font-mono text-pdv-muted">{horaFortaleza(h.createdAt)}</span>
                  <span>
                    {EVENTO[h.evento] ?? h.evento}
                    {h.evento === "STATUS" && h.status ? ` ${h.status.nome}` : ""}
                    {h.user?.name ? <span className="text-pdv-muted"> · {h.user.name}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
