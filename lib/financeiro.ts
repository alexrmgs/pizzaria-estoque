export const REVENUE_CHANNELS = ["LOJA_PROPRIA", "IFOOD", "NOVENTA_NOVE"] as const;

export const REVENUE_CHANNEL_LABELS: Record<string, string> = {
  LOJA_PROPRIA: "Loja própria",
  IFOOD: "iFood",
  NOVENTA_NOVE: "99Food",
};

export const MONTH_NAMES_SHORT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

export type RevenueRecord = {
  date: string; // YYYY-MM-DD
  storeId: string;
  storeName: string;
  channel: string;
  amount: number;
  orderCount: number;
};

export type MonthAgg = { month: number; amount: number; orders: number };

export type ChannelAgg = { channel: string; amount: number; orders: number };

export type StoreYearAgg = {
  storeId: string;
  storeName: string;
  months: MonthAgg[]; // 12 entradas, mês 0-11
  totalAmount: number;
  totalOrders: number;
  avgTicket: number;
};

export type MonthBest = {
  month: number;
  totalAmount: number;
  bestRevenueStore: string | null;
  bestRevenueAmount: number;
  bestRevenueShare: number | null;
  bestTicketStore: string | null;
  bestTicketAmount: number | null;
};

export type StoreScore = {
  storeId: string;
  storeName: string;
  totalAmount: number;
  totalOrders: number;
  avgTicket: number;
  scoreFat: number;
  scorePed: number;
  scoreTicket: number;
  finalScore: number;
};

export type YearlySummary = {
  year: number;
  totalAmount: number;
  totalOrders: number;
  overallTicket: number;
  stores: StoreYearAgg[];
  monthlyTotals: MonthAgg[];
  monthBests: MonthBest[];
  ranking: StoreScore[];
  bestRevenueStore: StoreScore | null;
  bestTicketStore: StoreScore | null;
  channelTotals: ChannelAgg[];
  channelMonthly: Record<string, MonthAgg[]>;
};

const SCORE_WEIGHT_FAT = 0.4;
const SCORE_WEIGHT_PED = 0.3;
const SCORE_WEIGHT_TICKET = 0.3;

/**
 * Agrega os lançamentos de faturamento de um ano num resumo pronto pra
 * exibir: totais por loja/mês, melhor loja de cada mês e um ranking com
 * score composto (40% faturamento + 30% pedidos + 30% ticket médio, cada
 * métrica normalizada contra o maior valor entre as lojas — mesmo cálculo
 * usado na planilha de controle).
 */
export function buildYearlySummary(
  records: RevenueRecord[],
  allStores: { id: string; name: string }[],
): YearlySummary {
  const storeById = new Map(allStores.map((s) => [s.id, s.name]));
  for (const r of records) storeById.set(r.storeId, r.storeName);

  const storeAggs = new Map<string, StoreYearAgg>();
  for (const [storeId, storeName] of storeById) {
    storeAggs.set(storeId, {
      storeId,
      storeName,
      months: Array.from({ length: 12 }, (_, month) => ({ month, amount: 0, orders: 0 })),
      totalAmount: 0,
      totalOrders: 0,
      avgTicket: 0,
    });
  }

  const monthlyTotals: MonthAgg[] = Array.from({ length: 12 }, (_, month) => ({
    month,
    amount: 0,
    orders: 0,
  }));

  const channelTotalsMap = new Map<string, ChannelAgg>();
  const channelMonthly: Record<string, MonthAgg[]> = {};
  for (const c of REVENUE_CHANNELS) {
    channelTotalsMap.set(c, { channel: c, amount: 0, orders: 0 });
    channelMonthly[c] = Array.from({ length: 12 }, (_, month) => ({ month, amount: 0, orders: 0 }));
  }

  for (const r of records) {
    const month = Number(r.date.slice(5, 7)) - 1;
    const agg = storeAggs.get(r.storeId);
    if (!agg) continue;
    agg.months[month].amount += r.amount;
    agg.months[month].orders += r.orderCount;
    agg.totalAmount += r.amount;
    agg.totalOrders += r.orderCount;
    monthlyTotals[month].amount += r.amount;
    monthlyTotals[month].orders += r.orderCount;

    const channelAgg =
      channelTotalsMap.get(r.channel) ?? { channel: r.channel, amount: 0, orders: 0 };
    channelAgg.amount += r.amount;
    channelAgg.orders += r.orderCount;
    channelTotalsMap.set(r.channel, channelAgg);
    const channelMonth = (channelMonthly[r.channel] ??= Array.from({ length: 12 }, (_, m) => ({
      month: m,
      amount: 0,
      orders: 0,
    })));
    channelMonth[month].amount += r.amount;
    channelMonth[month].orders += r.orderCount;
  }
  const channelTotals = [...channelTotalsMap.values()].sort((a, b) => b.amount - a.amount);

  for (const agg of storeAggs.values()) {
    agg.avgTicket = agg.totalOrders > 0 ? agg.totalAmount / agg.totalOrders : 0;
  }

  const stores = [...storeAggs.values()].sort((a, b) => b.totalAmount - a.totalAmount);

  const totalAmount = stores.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalOrders = stores.reduce((sum, s) => sum + s.totalOrders, 0);
  const overallTicket = totalOrders > 0 ? totalAmount / totalOrders : 0;

  const monthBests: MonthBest[] = monthlyTotals.map((mt) => {
    if (mt.amount <= 0) {
      return {
        month: mt.month,
        totalAmount: 0,
        bestRevenueStore: null,
        bestRevenueAmount: 0,
        bestRevenueShare: null,
        bestTicketStore: null,
        bestTicketAmount: null,
      };
    }
    let bestRevenue: StoreYearAgg | null = null;
    let bestTicketStore: string | null = null;
    let bestTicketAmount = -1;
    for (const s of stores) {
      const monthData = s.months[mt.month];
      if (monthData.amount > 0 && (!bestRevenue || monthData.amount > bestRevenue.months[mt.month].amount)) {
        bestRevenue = s;
      }
      const ticket = monthData.orders > 0 ? monthData.amount / monthData.orders : 0;
      if (ticket > bestTicketAmount) {
        bestTicketAmount = ticket;
        bestTicketStore = s.storeName;
      }
    }
    return {
      month: mt.month,
      totalAmount: mt.amount,
      bestRevenueStore: bestRevenue?.storeName ?? null,
      bestRevenueAmount: bestRevenue?.months[mt.month].amount ?? 0,
      bestRevenueShare: bestRevenue ? bestRevenue.months[mt.month].amount / mt.amount : null,
      bestTicketStore,
      bestTicketAmount: bestTicketAmount >= 0 ? bestTicketAmount : null,
    };
  });

  const maxAmount = Math.max(0, ...stores.map((s) => s.totalAmount));
  const maxOrders = Math.max(0, ...stores.map((s) => s.totalOrders));
  const maxTicket = Math.max(0, ...stores.map((s) => s.avgTicket));

  const ranking: StoreScore[] = stores
    .map((s) => {
      const scoreFat = maxAmount > 0 ? (s.totalAmount / maxAmount) * 10 : 0;
      const scorePed = maxOrders > 0 ? (s.totalOrders / maxOrders) * 10 : 0;
      const scoreTicket = maxTicket > 0 ? (s.avgTicket / maxTicket) * 10 : 0;
      const finalScore =
        SCORE_WEIGHT_FAT * scoreFat + SCORE_WEIGHT_PED * scorePed + SCORE_WEIGHT_TICKET * scoreTicket;
      return {
        storeId: s.storeId,
        storeName: s.storeName,
        totalAmount: s.totalAmount,
        totalOrders: s.totalOrders,
        avgTicket: s.avgTicket,
        scoreFat,
        scorePed,
        scoreTicket,
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  const bestRevenueStore = [...ranking].sort((a, b) => b.totalAmount - a.totalAmount)[0] ?? null;
  const bestTicketStore = [...ranking].sort((a, b) => b.avgTicket - a.avgTicket)[0] ?? null;

  return {
    year: 0,
    totalAmount,
    totalOrders,
    overallTicket,
    stores,
    monthlyTotals,
    monthBests,
    ranking,
    bestRevenueStore,
    bestTicketStore,
    channelTotals,
    channelMonthly,
  };
}

export type RevenueProjection = {
  year: number;
  yearActualSoFar: number;
  yearProjectedTotal: number;
  growthRate: number | null;
  currentMonth: number;
  currentMonthActual: number;
  currentMonthProjected: number;
};

/**
 * Projeta o fechamento do ano e do mês corrente a partir do histórico.
 * Meses já fechados entram como estão; o mês em andamento é extrapolado
 * pelo ritmo diário (total até agora ÷ dias passados × dias do mês); os
 * meses futuros usam o mesmo mês do ano anterior ajustado pela taxa de
 * crescimento observada nos meses já fechados deste ano (sem histórico do
 * ano anterior pra aquele mês, assume a média do que já rendeu esse ano).
 * `records` deve conter o histórico completo (qualquer período/loja) — a
 * função filtra sozinha o ano corrente e o anterior.
 */
export function computeRevenueProjection(
  records: { date: string; amount: number }[],
  today: Date = new Date(),
): RevenueProjection {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();

  const byMonthThisYear = Array.from({ length: 12 }, () => 0);
  const byMonthLastYear = Array.from({ length: 12 }, () => 0);
  let yearActualSoFar = 0;

  for (const r of records) {
    const y = Number(r.date.slice(0, 4));
    const m = Number(r.date.slice(5, 7)) - 1;
    if (y === year) {
      byMonthThisYear[m] += r.amount;
      yearActualSoFar += r.amount;
    } else if (y === year - 1) {
      byMonthLastYear[m] += r.amount;
    }
  }

  let completedThis = 0;
  let completedLast = 0;
  for (let m = 0; m < month; m++) {
    completedThis += byMonthThisYear[m];
    completedLast += byMonthLastYear[m];
  }
  const growthRate = completedLast > 0 ? (completedThis - completedLast) / completedLast : null;

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const currentMonthActual = byMonthThisYear[month];
  const currentMonthProjected = day > 0 ? (currentMonthActual / day) * daysInMonth : currentMonthActual;

  const avgThisYearSoFar = month > 0 ? completedThis / month : currentMonthActual;
  let projectedRemaining = 0;
  for (let m = month + 1; m < 12; m++) {
    if (byMonthLastYear[m] > 0) {
      projectedRemaining += byMonthLastYear[m] * (1 + (growthRate ?? 0));
    } else {
      projectedRemaining += avgThisYearSoFar;
    }
  }

  const yearProjectedTotal = completedThis + currentMonthProjected + projectedRemaining;

  return {
    year,
    yearActualSoFar,
    yearProjectedTotal,
    growthRate,
    currentMonth: month,
    currentMonthActual,
    currentMonthProjected,
  };
}
