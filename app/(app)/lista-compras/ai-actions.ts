"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { generatePurchaseAnalysis } from "@/lib/ai-analysis";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Quantos dias o estoque deve cobrir na "compra inteligente" (1 semana + folga).
const COBERTURA_DIAS = 8;

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
          isProduced: true,
        },
      }),
      prisma.stockMovement.findMany({
        where: { type: "SAIDA", createdAt: { gte: ha30 } },
        select: { ingredientId: true, quantity: true, createdAt: true },
      }),
    ]);

    // Consumo (saídas) por ingrediente em 7 e 30 dias.
    const saida7 = new Map<string, number>();
    const saida30 = new Map<string, number>();
    for (const m of movs) {
      const q = Number(m.quantity);
      saida30.set(m.ingredientId, (saida30.get(m.ingredientId) ?? 0) + q);
      if (m.createdAt >= ha7) saida7.set(m.ingredientId, (saida7.get(m.ingredientId) ?? 0) + q);
    }

    const comprar: string[] = [];
    const estoqueAlto: string[] = [];

    for (const ing of ingredientes) {
      if (ing.isProduced) continue; // produzido é fabricado, não comprado
      const estoque = Number(ing.currentStock);
      const min = Number(ing.minStock);
      const s7 = saida7.get(ing.id) ?? 0;
      const s30 = saida30.get(ing.id) ?? 0;

      // Consumo semanal estimado: usa a média dos 30 dias (mais estável); se só
      // tem dado recente, usa os 7 dias.
      const consumoSemana = s30 > 0 ? (s30 * 7) / 30 : s7;
      const diaria = consumoSemana / 7;
      const duraDias = diaria > 0 ? estoque / diaria : Infinity;

      if (consumoSemana > 0) {
        const alvo = diaria * COBERTURA_DIAS;
        const sugestao = Math.max(0, alvo - estoque);
        if (sugestao > 0.001) {
          comprar.push(
            `- ${ing.name} (${ing.unit}): comprar ~${n(sugestao)} · estoque atual ${n(estoque)} (dura ~${duraDias === Infinity ? "∞" : Math.round(duraDias)} dias) · consumo/semana ${n(consumoSemana)}`,
          );
        } else if (duraDias > 21) {
          estoqueAlto.push(
            `- ${ing.name} (${ing.unit}): estoque ${n(estoque)} dura ~${Math.round(duraDias)} dias · consumo/semana ${n(consumoSemana)}`,
          );
        }
      } else if (estoque < min) {
        // Sem consumo registrado, mas abaixo do mínimo → sugere repor até o mínimo.
        comprar.push(
          `- ${ing.name} (${ing.unit}): comprar ~${n(Math.max(min - estoque, 0))} · estoque atual ${n(estoque)} · abaixo do mínimo (${n(min)}) · sem consumo registrado`,
        );
      }
    }

    if (comprar.length === 0 && estoqueAlto.length === 0) {
      return {
        text: "Ainda não há saídas de estoque suficientes pra calcular o consumo. Registre as saídas (o que sai do estoque no dia a dia) que a IA passa a montar a lista de compras pelo seu movimento.",
      };
    }

    const linhas: string[] = [];
    linhas.push(
      `Cobertura alvo: ~${COBERTURA_DIAS} dias (1 semana com folga). "comprar ~X" já é o que falta pra durar esse período.`,
    );
    linhas.push("\nCOMPRA SUGERIDA (pelo consumo — durar ~1 semana):");
    linhas.push(comprar.length ? comprar.join("\n") : "(nenhum)");
    linhas.push("\nESTOQUE ALTO vs consumo (dinheiro parado — NÃO precisa comprar):");
    linhas.push(estoqueAlto.length ? estoqueAlto.slice(0, 40).join("\n") : "(nenhum)");

    const text = await generatePurchaseAnalysis(linhas.join("\n"));
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
