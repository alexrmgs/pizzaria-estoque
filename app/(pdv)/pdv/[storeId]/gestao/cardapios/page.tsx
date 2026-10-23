import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { NovoCardapioForm, UsarNaLojaBotao } from "./forms";

const CANAL: Record<string, string> = { PDV: "PDV (balcão/delivery)", IFOOD: "iFood", CARDAPIOWEB: "CardápioWeb", OUTRO: "Outro" };

export default async function CardapiosPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  const [cardapios, loja] = await Promise.all([
    prisma.pdvCardapio.findMany({
      where: { companyId: store!.companyId },
      orderBy: { createdAt: "asc" },
      include: { categorias: { where: { ativo: true }, select: { _count: { select: { itens: { where: { ativo: true } } } } } }, lojas: { select: { name: true } } },
    }),
    prisma.store.findUniqueOrThrow({ where: { id: store!.id }, select: { pdvCardapioId: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-pdv-display text-2xl font-extrabold">Cardápios</h1>
        <p className="text-sm text-pdv-muted">Cada cardápio é a vitrine de um canal: categorias (com dias e horários) e itens com preço próprio, apontando pros produtos mãe.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {cardapios.map((c) => {
          const itens = c.categorias.reduce((s, k) => s + k._count.itens, 0);
          const usado = loja.pdvCardapioId === c.id;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-pdv-lg bg-pdv-surface p-4">
              <Link href={`/pdv/${store!.id}/gestao/cardapios/${c.id}`} className="min-w-0 flex-1 rounded-pdv-sm outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent">
                <span className="block text-lg font-semibold underline-offset-4 hover:underline">{c.nome}</span>
                <span className="text-sm text-pdv-muted">
                  {CANAL[c.canal] ?? c.canal} · {c.categorias.length} categorias · {itens} itens
                  {c.lojas.length ? ` · PDV de ${c.lojas.map((l) => l.name).join(", ")}` : ""}
                </span>
              </Link>
              {usado ? (
                <span className="rounded-full bg-pdv-success px-3 py-1 text-xs font-bold text-pdv-on-accent uppercase">Usado nesta loja</span>
              ) : (
                <UsarNaLojaBotao storeId={store!.id} cardapioId={c.id} />
              )}
            </li>
          );
        })}
        {cardapios.length === 0 ? <li className="rounded-pdv-md border border-dashed border-pdv-line p-8 text-center text-pdv-muted">Nenhum cardápio ainda.</li> : null}
      </ul>

      <NovoCardapioForm storeId={store!.id} />
    </div>
  );
}
