import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { caixaAberto, normalizarTelefone, requirePdv } from "@/lib/pdv";
import { buscarCliente } from "../actions";
import { NovaVenda } from "./nova-venda";
import { cardapioDaLoja, itensParaVenda } from "@/lib/pdv-cardapio";

export default async function NovaVendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ tel?: string; balcao?: string }>;
}) {
  const { storeId } = await params;
  const { tel, balcao } = await searchParams;
  const { user, store } = await requirePdv(storeId);
  const caixa = await caixaAberto(store!.id, user.id);

  if (!caixa) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-pdv-display text-2xl font-extrabold">Seu caixa está fechado</p>
        <p className="max-w-sm text-pdv-muted">Pra vender, primeiro abra o caixa com o troco do início do turno.</p>
        <Link
          href={`/pdv/${store!.id}/caixa`}
          className="inline-flex h-12 items-center rounded-pdv-md bg-pdv-accent px-5 font-semibold text-pdv-on-accent outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pdv-bg"
        >
          Abrir caixa
        </Link>
      </main>
    );
  }

  const telDigitos = normalizarTelefone(tel ?? "");
  const inicial = telDigitos.length >= 8 ? { telefone: telDigitos, cliente: await buscarCliente(store!.id, telDigitos) } : undefined;

  const [cardapio, formas] = await Promise.all([
    cardapioDaLoja(store!.id, store!.companyId),
    prisma.pdvFormaPagamento.findMany({ where: { companyId: store!.companyId, ativo: true }, orderBy: { ordem: "asc" } }),
  ]);
  const categorias = cardapio ? itensParaVenda(cardapio) : [];

  return (
    <NovaVenda
      storeId={store!.id}
      categorias={categorias}
      formas={formas.map((f) => ({ id: f.id, nome: f.nome, tipo: f.tipo as "DINHEIRO" }))}
      inicial={inicial}
      balcaoDireto={balcao === "1"}
    />
  );
}
