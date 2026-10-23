import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { horaFortaleza, requirePdv, textoEndereco } from "@/lib/pdv";
import { brl, formatarTelefone, ModuloTag, type Modulo } from "@/components/pdv/primitives";

const SITUACAO: Record<string, { label: string; cls: string }> = {
  ABERTA: { label: "Em andamento", cls: "text-pdv-warning" },
  PAGA: { label: "Finalizado", cls: "text-pdv-success" },
  CANCELADA: { label: "Cancelado", cls: "text-pdv-danger" },
};

export default async function ClientePage({ params }: { params: Promise<{ storeId: string; clienteId: string }> }) {
  const { storeId, clienteId } = await params;
  const { store } = await requirePdv(storeId);

  const cliente = await prisma.pdvCliente.findFirst({
    where: { id: clienteId, companyId: store!.companyId },
    include: {
      enderecos: { orderBy: { updatedAt: "desc" } },
      vendas: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { store: { select: { name: true } }, itens: { where: { canceladoEm: null }, select: { nome: true, qtd: true } } },
      },
    },
  });
  if (!cliente) notFound();

  const validas = cliente.vendas.filter((v) => v.situacao !== "CANCELADA");
  const gasto = validas.reduce((s, v) => s + Number(v.total), 0);
  const ticket = validas.length ? gasto / validas.length : 0;

  // o que mais pede
  const contagem = new Map<string, number>();
  for (const v of validas) for (const i of v.itens) contagem.set(i.nome, (contagem.get(i.nome) ?? 0) + Number(i.qtd));
  const favoritos = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/pdv/${store!.id}/clientes`}
          aria-label="Voltar pros clientes"
          className="grid size-11 place-items-center rounded-pdv-sm text-pdv-muted outline-none hover:bg-pdv-raised hover:text-pdv-text focus-visible:ring-3 focus-visible:ring-pdv-accent"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-pdv-display text-2xl font-extrabold">{cliente.nome}</h1>
          <a href={`tel:${cliente.telefone}`} className="flex items-center gap-1.5 font-mono text-sm text-pdv-delivery underline-offset-4 hover:underline">
            <Phone className="size-4" aria-hidden /> {formatarTelefone(cliente.telefone)}
          </a>
        </div>
        <Link
          href={`/pdv/${store!.id}/nova?tel=${cliente.telefone}`}
          className="inline-flex h-12 items-center gap-2 rounded-pdv-md bg-pdv-accent px-4 font-semibold text-pdv-on-accent outline-none hover:bg-pdv-accent-hover focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pdv-bg"
        >
          <Plus className="size-5" aria-hidden /> Novo pedido
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumo do cliente">
        {[
          { l: "Pedidos", v: String(validas.length) },
          { l: "Total gasto", v: brl(gasto) },
          { l: "Ticket médio", v: brl(ticket) },
          { l: "Cliente desde", v: cliente.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) },
        ].map((k) => (
          <div key={k.l} className="rounded-pdv-md bg-pdv-surface p-3">
            <p className="text-xs text-pdv-muted uppercase">{k.l}</p>
            <p className="font-mono text-lg font-bold">{k.v}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="end-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
            <h2 id="end-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Endereços</h2>
            {cliente.enderecos.length === 0 ? <p className="text-sm text-pdv-muted">Nenhum endereço salvo.</p> : null}
            {cliente.enderecos.map((e) => (
              <p key={e.id} className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-pdv-delivery" aria-hidden />
                <span className="flex-1">{textoEndereco(e)}</span>
                {Number(e.taxaEntrega) > 0 ? <span className="font-mono text-pdv-muted">{brl(Number(e.taxaEntrega))}</span> : null}
              </p>
            ))}
          </section>
          {favoritos.length ? (
            <section aria-labelledby="fav-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
              <h2 id="fav-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Mais pede</h2>
              {favoritos.map(([nome, qtd]) => (
                <p key={nome} className="flex justify-between text-sm">
                  <span>{nome}</span>
                  <span className="font-mono text-pdv-muted">{qtd}×</span>
                </p>
              ))}
            </section>
          ) : null}
        </div>

        <section aria-labelledby="ped-h" className="flex flex-col gap-2 rounded-pdv-lg bg-pdv-surface p-4">
          <h2 id="ped-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">Pedidos</h2>
          {cliente.vendas.length === 0 ? <p className="text-sm text-pdv-muted">Nenhum pedido ainda.</p> : null}
          <ul className="flex flex-col divide-y divide-pdv-line">
            {cliente.vendas.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/pdv/${v.storeId}/pedido/${v.id}`}
                  className="flex flex-col gap-1 rounded-pdv-sm px-1 py-2 outline-none hover:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-pdv-muted">
                      {v.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })} {horaFortaleza(v.createdAt)}
                    </span>
                    <span className="font-bold">#{v.numero}</span>
                    <ModuloTag modulo={v.modulo as Modulo} />
                    <span className={`text-xs font-semibold ${SITUACAO[v.situacao]?.cls ?? ""}`}>{SITUACAO[v.situacao]?.label}</span>
                    <span className={`ml-auto font-mono font-bold ${v.situacao === "CANCELADA" ? "line-through opacity-50" : ""}`}>{brl(Number(v.total))}</span>
                  </span>
                  <span className="truncate text-sm text-pdv-muted">
                    {v.itens.map((i) => `${Number(i.qtd)}× ${i.nome}`).join(", ")}
                    {v.storeId !== store!.id ? ` · ${v.store.name}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
