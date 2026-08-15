"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  buildYearlySummary,
  MONTH_NAMES_SHORT,
  REVENUE_CHANNEL_LABELS,
  type RevenueRecord,
} from "@/lib/financeiro";
import { generateBusinessAnalysis } from "@/lib/ai-analysis";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function analisarFinanceiro(): Promise<{ text?: string; error?: string }> {
  const user = await requirePermission("canViewRelatorios");

  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    const from = new Date(Date.UTC(year - 1, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [stores, revenues] = await Promise.all([
      prisma.store.findMany({
        where: { companyId: user.companyId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.revenue.findMany({
        where: { date: { gte: from, lte: to }, store: { companyId: user.companyId } },
        include: { store: { select: { name: true } } },
      }),
    ]);

    const toRecords = (targetYear: number): RevenueRecord[] =>
      revenues
        .filter((r) => r.date.getUTCFullYear() === targetYear)
        .map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          storeId: r.storeId,
          storeName: r.store.name,
          channel: r.channel,
          amount: Number(r.amount),
          orderCount: r.orderCount,
        }));

    const thisYear = buildYearlySummary(toRecords(year), stores);
    const lastYear = buildYearlySummary(toRecords(year - 1), stores);

    const lines: string[] = [];
    lines.push(`Ano atual: ${year} (em andamento). Ano anterior: ${year - 1} (fechado).`);
    lines.push(
      `Faturamento total ${year}: ${brl(thisYear.totalAmount)} | ${year - 1}: ${brl(lastYear.totalAmount)}.`,
    );
    lines.push(
      `Pedidos ${year}: ${thisYear.totalOrders} | Ticket médio ${year}: ${brl(thisYear.overallTicket)}.`,
    );

    lines.push("\nPor loja (faturamento ano atual vs. ano anterior):");
    for (const s of thisYear.stores) {
      const prev = lastYear.stores.find((p) => p.storeId === s.storeId);
      const prevAmount = prev?.totalAmount ?? 0;
      const growth = prevAmount > 0 ? ((s.totalAmount - prevAmount) / prevAmount) * 100 : null;
      lines.push(
        `- ${s.storeName}: ${brl(s.totalAmount)} vs ${brl(prevAmount)}${
          growth !== null ? ` (${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%)` : ""
        } · ${s.totalOrders} pedidos · ticket ${brl(s.avgTicket)}`,
      );
    }

    lines.push(`\nPor canal de venda (${year}):`);
    for (const c of thisYear.channelTotals) {
      const share = thisYear.totalAmount > 0 ? (c.amount / thisYear.totalAmount) * 100 : 0;
      lines.push(`- ${REVENUE_CHANNEL_LABELS[c.channel] ?? c.channel}: ${brl(c.amount)} (${share.toFixed(1)}%)`);
    }

    lines.push(`\nFaturamento mês a mês (${year}):`);
    for (const m of thisYear.monthlyTotals) {
      if (m.amount > 0) lines.push(`- ${MONTH_NAMES_SHORT[m.month]}: ${brl(m.amount)}`);
    }

    const text = await generateBusinessAnalysis(
      `Análise do desempenho financeiro da rede de pizzarias.`,
      lines.join("\n"),
    );
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
