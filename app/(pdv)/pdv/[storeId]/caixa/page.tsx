import { prisma } from "@/lib/prisma";
import { caixaAberto, esperadoDoCaixa, horaFortaleza, requirePdv } from "@/lib/pdv";
import { brl } from "@/components/pdv/primitives";
import { AbrirCaixaForm, FecharCaixaForm, MovimentoCaixaForm } from "./forms";

const TIPO_MOV: Record<string, string> = { REFORCO: "Reforço", SANGRIA: "Sangria", DESPESA: "Despesa" };

export default async function CaixaPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ fechado?: string }>;
}) {
  const { storeId } = await params;
  const { fechado } = await searchParams;
  const { user, store } = await requirePdv(storeId);
  const caixa = await caixaAberto(store!.id, user.id);

  if (!caixa) {
    const resumo = fechado
      ? await prisma.pdvCaixa.findFirst({
          where: { id: fechado, storeId: store!.id, abertoPorId: user.id },
          include: { conferencias: { include: { forma: true }, orderBy: { forma: { ordem: "asc" } } } },
        })
      : null;
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-8 p-4 md:p-8">
        {resumo ? (
          <section className="flex flex-col gap-3 rounded-pdv-lg border border-pdv-line bg-pdv-surface p-4" aria-labelledby="resumo-h">
            <h2 id="resumo-h" className="font-pdv-display text-lg font-extrabold">Caixa fechado ✓</h2>
            <p className="text-sm text-pdv-muted">
              {horaFortaleza(resumo.abertoEm)} → {resumo.fechadoEm ? horaFortaleza(resumo.fechadoEm) : ""}
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-pdv-muted uppercase">
                <tr>
                  <th className="py-1 font-semibold">Forma</th>
                  <th className="py-1 text-right font-semibold">Esperado</th>
                  <th className="py-1 text-right font-semibold">Contado</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {resumo.conferencias.map((c) => (
                  <tr key={c.formaId} className="border-t border-pdv-line">
                    <td className="py-2 font-sans">{c.forma.nome}</td>
                    <td className="py-2 text-right">{brl(Number(c.esperado))}</td>
                    <td className={`py-2 text-right ${Number(c.contado) === Number(c.esperado) ? "text-pdv-success" : "text-pdv-warning"}`}>
                      {brl(Number(c.contado))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resumo.obs ? <p className="text-sm">Obs: {resumo.obs}</p> : null}
          </section>
        ) : null}
        <AbrirCaixaForm storeId={store!.id} />
      </main>
    );
  }

  const [{ linhas }, movimentos, vendas] = await Promise.all([
    esperadoDoCaixa(caixa.id),
    prisma.pdvCaixaMovimento.findMany({ where: { caixaId: caixa.id }, orderBy: { createdAt: "desc" } }),
    prisma.pdvVenda.aggregate({ where: { caixaId: caixa.id, situacao: { not: "CANCELADA" } }, _count: true, _sum: { total: true } }),
  ]);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 p-4 md:p-8 lg:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-3 gap-2" aria-label="Resumo do turno">
          {[
            { label: "Aberto às", valor: horaFortaleza(caixa.abertoEm) },
            { label: "Troco inicial", valor: brl(Number(caixa.valorInicial)) },
            { label: `${vendas._count} vendas`, valor: brl(Number(vendas._sum.total ?? 0)) },
          ].map((k) => (
            <div key={k.label} className="rounded-pdv-md bg-pdv-surface p-3">
              <p className="text-xs text-pdv-muted uppercase">{k.label}</p>
              <p className="font-mono text-lg font-bold tabular-nums">{k.valor}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="mov-h">
          <h2 id="mov-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">
            Sangria, reforço e despesa
          </h2>
          <MovimentoCaixaForm storeId={store!.id} />
          {movimentos.length === 0 ? (
            <p className="text-sm text-pdv-muted">Nenhum movimento nesse turno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-pdv-line rounded-pdv-md bg-pdv-surface">
              {movimentos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-16 font-semibold">{TIPO_MOV[m.tipo]}</span>
                  <span className="min-w-0 flex-1 truncate text-pdv-muted">{m.motivo}</span>
                  <span className={`font-mono tabular-nums ${m.tipo === "REFORCO" ? "text-pdv-success" : "text-pdv-danger"}`}>
                    {m.tipo === "REFORCO" ? "+" : "−"}
                    {brl(Number(m.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="fechar-h">
        <h2 id="fechar-h" className="font-pdv-display text-sm font-extrabold tracking-wider text-pdv-accent uppercase">
          Fechar caixa
        </h2>
        <p className="text-sm text-pdv-muted">Conte o que tem em cada forma e digite. Se não bater, explique na observação.</p>
        <FecharCaixaForm storeId={store!.id} linhas={linhas.map((l) => ({ id: l.formaId, forma: l.forma, esperado: l.esperado }))} />
      </section>
    </main>
  );
}
