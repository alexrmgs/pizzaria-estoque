"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { generatePurchaseAnalysis } from "@/lib/ai-analysis";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export async function analisarCompras(): Promise<{ text?: string; error?: string }> {
  await requirePermission("canManageEstoque");

  try {
    const agora = new Date();
    const ha7 = new Date(agora.getTime() - 7 * 86_400_000);
    const ha30 = new Date(agora.getTime() - 30 * 86_400_000);

    const [ingredientes, movs] = await Promise.all([
      prisma.ingredient.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          unit: true,
          currentStock: true,
          minStock: true,
          idealStock: true,
        },
      }),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: ha30 } },
        select: { ingredientId: true, type: true, quantity: true, createdAt: true },
      }),
    ]);

    // Consumo (saídas) e compras (entradas) por ingrediente, 7 e 30 dias.
    type Agg = { saida7: number; saida30: number; entrada7: number; entrada30: number };
    const agg = new Map<string, Agg>();
    for (const m of movs) {
      const a = agg.get(m.ingredientId) ?? { saida7: 0, saida30: 0, entrada7: 0, entrada30: 0 };
      const q = Number(m.quantity);
      const dentro7 = m.createdAt >= ha7;
      if (m.type === "SAIDA") {
        a.saida30 += q;
        if (dentro7) a.saida7 += q;
      } else {
        a.entrada30 += q;
        if (dentro7) a.entrada7 += q;
      }
      agg.set(m.ingredientId, a);
    }

    const linhas: string[] = [];
    linhas.push("Insumos (estoque atual, consumo e compras nas últimas semanas):");
    let incluidos = 0;
    for (const ing of ingredientes) {
      const a = agg.get(ing.id);
      const estoque = Number(ing.currentStock);
      const ideal = ing.idealStock !== null ? Number(ing.idealStock) : null;
      const min = Number(ing.minStock);
      const temMov = a && (a.saida30 > 0 || a.entrada30 > 0);
      const abaixo = estoque <= (ideal ?? min);
      // Só manda pra IA o que é relevante (teve movimento ou está baixo).
      if (!temMov && !abaixo) continue;
      if (incluidos >= 80) break;
      incluidos++;

      const partes = [
        `- ${ing.name} (${ing.unit}): estoque ${n(estoque)}`,
        `mín ${n(min)}`,
      ];
      if (ideal !== null) partes.push(`ideal ${n(ideal)}`);
      partes.push(`consumo 7d ${n(a?.saida7 ?? 0)}`);
      partes.push(`consumo 30d ${n(a?.saida30 ?? 0)}`);
      if ((a?.entrada7 ?? 0) > 0 || (a?.entrada30 ?? 0) > 0) {
        partes.push(`comprado 7d ${n(a?.entrada7 ?? 0)} / 30d ${n(a?.entrada30 ?? 0)}`);
      }
      linhas.push(partes.join(" · "));
    }

    if (incluidos === 0) {
      return { text: "Sem movimentação suficiente pra analisar ainda. Registre entradas e saídas de estoque que a IA passa a sugerir compras." };
    }

    const text = await generatePurchaseAnalysis(linhas.join("\n"));
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
