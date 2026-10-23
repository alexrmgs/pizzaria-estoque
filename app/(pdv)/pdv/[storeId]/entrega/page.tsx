import { prisma } from "@/lib/prisma";
import { requirePdv } from "@/lib/pdv";
import { FaixasForm } from "./faixas-form";

// Sugestão inicial quando a loja ainda não tem faixas — só preenche a tela,
// nada é salvo até clicar em Salvar.
const SUGESTAO = [
  { ateKm: 2, taxa: 5 },
  { ateKm: 4, taxa: 7 },
  { ateKm: 6, taxa: 9 },
  { ateKm: 8, taxa: 12 },
];

export default async function TaxasEntregaPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  const [loja, faixas] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: store!.id }, select: { name: true, address: true, latitude: true, longitude: true } }),
    prisma.pdvFaixaEntrega.findMany({ where: { storeId: store!.id }, orderBy: { ateKm: "asc" } }),
  ]);
  const lat = Number(loja.latitude);
  const lng = Number(loja.longitude);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-4 md:p-8">
      <div>
        <h1 className="font-pdv-display text-2xl font-extrabold">Taxas de entrega</h1>
        <p className="mt-1 text-sm text-pdv-muted">
          A distância é medida em linha reta da loja até o endereço do cliente. Vale a primeira faixa que cobre a distância; acima da última,
          o pedido é marcado como fora da área (dá pra digitar a taxa na mão).
        </p>
      </div>

      <section className="rounded-pdv-md bg-pdv-surface p-3 text-sm" aria-label="Ponto da loja">
        <p className="font-semibold">Ponto da loja ({loja.name})</p>
        <p className="text-pdv-muted">
          {loja.address ? `${loja.address} · ` : ""}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-pdv-delivery underline-offset-4 hover:underline"
          >
            ver no mapa
          </a>
        </p>
        <p className="mt-1 text-xs text-pdv-muted">É o mesmo ponto usado no ponto eletrônico (Configurações → Lojas). Se estiver errado, corrija lá.</p>
      </section>

      <FaixasForm storeId={store!.id} inicial={faixas.length ? faixas.map((f) => ({ ateKm: Number(f.ateKm), taxa: Number(f.taxa) })) : SUGESTAO} sugestao={!faixas.length} />
    </main>
  );
}
