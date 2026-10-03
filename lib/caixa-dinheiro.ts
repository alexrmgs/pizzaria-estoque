import { prisma } from "@/lib/prisma";
import { COINS } from "@/app/(app)/caixa-dinheiro/coins";

// Fechamento de um mês do caixa de dinheiro (mesma conta da tela
// /caixa-dinheiro): saldo final em R$ e quantas moedas de cada sobraram.
// Usado pra abrir o mês seguinte "puxando do mês anterior".

export type ResumoCaixaMes = {
  temDados: boolean;
  saldoFinal: number;
  moedas: Record<(typeof COINS)[number]["ini"], number>;
};

export async function resumoCaixaMes(companyId: string, monthKey: string): Promise<ResumoCaixaMes> {
  const [ano, mes] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(ano, mes - 1, 1));
  const monthEnd = new Date(Date.UTC(ano, mes, 0, 23, 59, 59));

  const [config, entries, coins] = await Promise.all([
    prisma.cashMonth.findUnique({ where: { companyId_month: { companyId, month: monthKey } } }),
    prisma.cashEntry.findMany({ where: { companyId, date: { gte: monthStart, lte: monthEnd } } }),
    prisma.coinMovement.findMany({ where: { companyId, date: { gte: monthStart, lte: monthEnd } } }),
  ]);

  const coinValor = (m: (typeof coins)[number]) =>
    COINS.reduce((s, c) => s + (m[c.q] as number) * c.value, 0);

  let saldo = Number(config?.saldoInicial ?? 0);
  for (const e of entries) saldo += (e.direction === "ENTRADA" ? 1 : -1) * Number(e.amount);
  for (const m of coins) saldo += (m.direction === "ENTRADA" ? 1 : -1) * coinValor(m);

  const moedas = Object.fromEntries(
    COINS.map((c) => {
      const ini = Number(config?.[c.ini] ?? 0);
      const mov = coins.reduce(
        (s, m) => s + (m.direction === "ENTRADA" ? 1 : -1) * (m[c.q] as number),
        0,
      );
      return [c.ini, Math.max(0, ini + mov)];
    }),
  ) as ResumoCaixaMes["moedas"];

  return {
    temDados: !!config || entries.length > 0 || coins.length > 0,
    saldoFinal: Math.round(saldo * 100) / 100,
    moedas,
  };
}
