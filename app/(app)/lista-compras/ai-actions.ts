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
          isProduced: true,
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

    const faltando: string[] = [];
    const comConsumo: string[] = [];

    for (const ing of ingredientes) {
      if (ing.isProduced) continue; // produzido é fabricado, não comprado
      const a = agg.get(ing.id);
      const estoque = Number(ing.currentStock);
      const min = Number(ing.minStock);
      const ideal = ing.idealStock !== null ? Number(ing.idealStock) : null;
      const alvo = ideal !== null && ideal > min ? ideal : min;
      const falta = Math.max(alvo - estoque, 0);
      const temMov = a && (a.saida30 > 0 || a.entrada30 > 0);

      // Está faltando (abaixo do mínimo/ideal) → sempre entra na lista de compra.
      if (falta > 0) {
        const abaixoMin = estoque < min;
        faltando.push(
          `- ${ing.name} (${ing.unit}): estoque ${n(estoque)}` +
            (abaixoMin ? " [ABAIXO DO MÍNIMO]" : "") +
            ` · mín ${n(min)}${ideal !== null ? ` · ideal ${n(ideal)}` : ""}` +
            ` · falta ~${n(falta)} pro ${ideal !== null && ideal > min ? "ideal" : "mínimo"}` +
            ` · consumo 7d ${n(a?.saida7 ?? 0)} / 30d ${n(a?.saida30 ?? 0)}`,
        );
      } else if (temMov) {
        // Estoque ok, mas mostra consumo x estoque pra IA achar dinheiro parado.
        comConsumo.push(
          `- ${ing.name} (${ing.unit}): estoque ${n(estoque)} · consumo 7d ${n(a?.saida7 ?? 0)} / 30d ${n(a?.saida30 ?? 0)}` +
            ((a?.entrada30 ?? 0) > 0 ? ` · comprado 30d ${n(a?.entrada30 ?? 0)}` : ""),
        );
      }
    }

    if (faltando.length === 0 && comConsumo.length === 0) {
      return {
        text: "Nenhum insumo abaixo do estoque e sem movimentação pra analisar. Cadastre estoque mínimo/ideal nos ingredientes e registre as saídas que a IA passa a sugerir compras.",
      };
    }

    const linhas: string[] = [];
    linhas.push(
      "ITENS FALTANDO (abaixo do mínimo/ideal — precisam de compra; a quantidade sugerida é pelo menos o que falta):",
    );
    linhas.push(faltando.length ? faltando.join("\n") : "(nenhum)");
    linhas.push("\nITENS COM ESTOQUE OK (pra checar se há compra em excesso / dinheiro parado):");
    linhas.push(comConsumo.length ? comConsumo.slice(0, 60).join("\n") : "(nenhum)");

    const text = await generatePurchaseAnalysis(linhas.join("\n"));
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
