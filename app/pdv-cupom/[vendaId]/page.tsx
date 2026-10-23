import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { horaFortaleza, requirePdv } from "@/lib/pdv";
import { CupomAcoes } from "./acoes";

// Via do pedido pra impressora térmica de 80mm, pelo próprio navegador
// (fatia 1 do PDV — sem agente de impressão). Fica fora do tema escuro do
// PDV de propósito: impressão é preto no branco.

const brl = (v: unknown) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function CupomPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendaId: string }>;
  searchParams: Promise<{ imprimir?: string; voltar?: string }>;
}) {
  const { vendaId } = await params;
  const { imprimir, voltar } = await searchParams;
  const { user } = await requirePdv();

  const venda = await prisma.pdvVenda.findFirst({
    where: { id: vendaId, store: { companyId: user.companyId } },
    include: {
      store: { select: { id: true, name: true } },
      cliente: { select: { telefone: true } },
      itens: { where: { canceladoEm: null }, orderBy: { createdAt: "asc" } },
      pagamentos: { where: { estornadoEm: null }, include: { forma: true } },
    },
  });
  if (!venda) notFound();

  const role = await prisma.role.findUnique({ where: { id: user.role.id }, select: { canGerenciarPdv: true } });
  // só aceita voltar pra dentro do PDV (nada de redirecionar pra fora)
  const destino = voltar?.startsWith("/pdv/") ? voltar : `/pdv/${venda.store.id}`;
  const cancelada = venda.situacao === "CANCELADA";

  return (
    <main className="flex flex-1 flex-col items-center gap-4 bg-neutral-200 p-4 print:block print:bg-white print:p-0">
      <style>{`@page { size: 80mm auto; margin: 0; } @media print { body { background: #fff; } }`}</style>

      <CupomAcoes
        storeId={venda.store.id}
        vendaId={venda.id}
        voltar={destino}
        autoImprimir={imprimir === "iframe" ? "iframe" : imprimir === "1"}
        podeCancelar={!!role?.canGerenciarPdv && !cancelada}
      />

      <article className="w-[72mm] bg-white p-[3mm] font-mono text-[12px] leading-snug text-black shadow print:shadow-none">
        <p className="text-center text-[13px] font-bold">{venda.store.name}</p>
        <p className="text-center">{venda.dia.toISOString().slice(0, 10).split("-").reverse().join("/")} {horaFortaleza(venda.createdAt)}</p>
        <p className="my-2 border-y border-dashed border-black py-1 text-center text-[22px] font-bold">
          PEDIDO {venda.numero}
        </p>
        {cancelada ? <p className="mb-2 text-center text-[16px] font-bold">*** CANCELADO ***</p> : null}
        {venda.modulo === "DELIVERY" ? (
          <div className="border-b border-dashed border-black pb-1">
            <p className="text-[14px] font-bold">DELIVERY</p>
            <p className="font-bold">{venda.clienteNome}</p>
            {venda.cliente?.telefone ? <p>Tel: {venda.cliente.telefone}</p> : null}
            <p className="font-bold">{venda.enderecoTexto}</p>
            {venda.obsEntrega ? <p>Obs: {venda.obsEntrega}</p> : null}
          </div>
        ) : (
          <p className="font-bold">BALCÃO{venda.clienteNome ? ` · ${venda.clienteNome}` : ""}</p>
        )}

        <table className="mt-2 w-full">
          <tbody>
            {venda.itens.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="pr-1 font-bold">{Number(i.qtd)}x</td>
                <td className="w-full">
                  <span className="font-bold">{i.nome}</span>
                  {i.obs ? <span className="block">&gt;&gt; {i.obs}</span> : null}
                </td>
                <td className="pl-1 text-right">{brl(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 border-t border-dashed border-black pt-1">
          {Number(venda.desconto) > 0 || Number(venda.taxaEntrega) > 0 ? (
            <p className="flex justify-between"><span>Itens</span><span>{brl(venda.subtotal)}</span></p>
          ) : null}
          {Number(venda.taxaEntrega) > 0 ? (
            <p className="flex justify-between"><span>Taxa de entrega</span><span>{brl(venda.taxaEntrega)}</span></p>
          ) : null}
          {Number(venda.desconto) > 0 ? (
            <p className="flex justify-between"><span>Desconto</span><span>-{brl(venda.desconto)}</span></p>
          ) : null}
          <p className="flex justify-between text-[15px] font-bold"><span>TOTAL</span><span>R$ {brl(venda.total)}</span></p>
          {venda.situacao === "ABERTA" ? <p className="mt-1 font-bold">A RECEBER:</p> : null}
          {venda.pagamentos.map((p) => (
            <p key={p.id} className="flex justify-between">
              <span>{p.forma.nome}</span>
              <span>{brl(p.valor)}</span>
            </p>
          ))}
          {venda.pagamentos.map((p) =>
            p.trocoPara ? (
              <p key={`t${p.id}`} className="flex justify-between">
                <span>Troco p/ {brl(p.trocoPara)}</span>
                <span>{brl(Number(p.trocoPara) - Number(p.valor))}</span>
              </p>
            ) : null
          )}
        </div>
        {venda.obs ? <p className="mt-2">Obs: {venda.obs}</p> : null}
        <p className="mt-3 text-center text-[10px]">não é documento fiscal</p>
      </article>
    </main>
  );
}
