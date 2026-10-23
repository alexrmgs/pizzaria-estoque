import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { brl, formatarTelefone } from "@/components/pdv/primitives";

const POR_PAGINA = 50;

export default async function ClientesPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { storeId } = await params;
  const { q = "" } = await searchParams;
  const { store } = await requirePdv(storeId);
  const termo = q.trim();
  const digitos = termo.replace(/\D/g, "");

  const clientes = await prisma.pdvCliente.findMany({
    where: {
      companyId: store!.companyId,
      ...(termo
        ? { OR: [{ nome: { contains: termo, mode: "insensitive" as const } }, ...(digitos.length >= 3 ? [{ telefone: { contains: digitos } }] : [])] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: POR_PAGINA,
    include: { _count: { select: { vendas: true } } },
  });

  // total gasto e último pedido (só pedidos não cancelados)
  const resumo = clientes.length
    ? await prisma.pdvVenda.groupBy({
        by: ["clienteId"],
        where: { clienteId: { in: clientes.map((c) => c.id) }, situacao: { not: "CANCELADA" } },
        _sum: { total: true },
        _max: { createdAt: true },
      })
    : [];
  const porCliente = new Map(resumo.map((r) => [r.clienteId, r]));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-pdv-display text-2xl font-extrabold">Clientes</h1>
        <form className="relative ml-auto w-full sm:w-80" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pdv-muted" aria-hidden />
          <input
            name="q"
            defaultValue={termo}
            type="search"
            aria-label="Buscar cliente por nome ou telefone"
            placeholder="Nome ou telefone"
            className="h-12 w-full rounded-pdv-md border border-pdv-line-input bg-pdv-surface pr-3 pl-9 outline-none placeholder:text-pdv-muted focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40"
          />
        </form>
      </div>

      {clientes.length === 0 ? (
        <p className="rounded-pdv-md border border-dashed border-pdv-line p-8 text-center text-pdv-muted">
          {termo ? `Nenhum cliente com “${termo}”.` : "Nenhum cliente ainda — eles são cadastrados no primeiro pedido delivery."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-pdv-line overflow-hidden rounded-pdv-lg bg-pdv-surface">
          {clientes.map((c) => {
            const r = porCliente.get(c.id);
            const ultimo = r?._max.createdAt;
            return (
              <li key={c.id}>
                <Link
                  href={`/pdv/${store!.id}/clientes/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-pdv-raised focus-visible:bg-pdv-raised focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.nome}</span>
                    <span className="font-mono text-sm text-pdv-muted">{formatarTelefone(c.telefone)}</span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-mono font-bold">{brl(Number(r?._sum.total ?? 0))}</span>
                    <span className="text-pdv-muted">
                      {c._count.vendas} pedido{c._count.vendas === 1 ? "" : "s"}
                      {ultimo ? ` · último ${ultimo.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {clientes.length === POR_PAGINA ? <p className="text-center text-sm text-pdv-muted">Mostrando os {POR_PAGINA} mais recentes — use a busca.</p> : null}
    </main>
  );
}
