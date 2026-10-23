import { prisma } from "@/lib/prisma";
import { diaOperacional, etapasDoPedido, horaFortaleza, minutosDesde, requirePdv } from "@/lib/pdv";
import { QuadroPedidos, type ColunaQuadro } from "./quadro";

export default async function QuadroPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId);
  const hoje = diaOperacional();
  const ontem = new Date(hoje.getTime() - 86_400_000);

  const [status, vendas] = await Promise.all([
    prisma.pdvStatus.findMany({ where: { storeId: store!.id }, orderBy: { ordem: "asc" } }),
    prisma.pdvVenda.findMany({
      where: {
        storeId: store!.id,
        situacao: { not: "CANCELADA" },
        // hoje inteiro + o que sobrou de ontem sem ser entregue
        OR: [{ dia: hoje }, { dia: ontem, status: { tag: { notIn: ["ENTREGUE", "FINALIZADO"] } } }],
      },
      include: { historico: { orderBy: { createdAt: "asc" }, select: { createdAt: true, evento: true, statusId: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const colunas: ColunaQuadro[] = status.map((s, i) => ({
    id: s.id,
    nome: s.nome,
    cor: s.cor,
    primeira: i === 0,
    ultima: i === status.length - 1,
    pedidos: vendas
      .filter((v) => v.statusId === s.id)
      .map((v) => ({
        id: v.id,
        numero: v.numero,
        modulo: v.modulo as "BALCAO" | "DELIVERY",
        cliente: v.clienteNome || (v.modulo === "DELIVERY" ? "Delivery" : "Balcão"),
        endereco: v.enderecoTexto ?? undefined,
        taxaEntrega: Number(v.taxaEntrega) || undefined,
        total: Number(v.total),
        hora: horaFortaleza(v.createdAt),
        minutosNoStatus: minutosDesde(v.historico.at(-1)?.createdAt ?? v.createdAt),
        etapas: etapasDoPedido(status, v.historico, v.statusId)
          .filter((e) => e.em)
          .map((e) => ({ nome: e.nome, hora: horaFortaleza(e.em!) })),
      })),
  }));

  return <QuadroPedidos storeId={store!.id} colunas={colunas} />;
}
