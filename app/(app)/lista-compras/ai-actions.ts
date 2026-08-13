"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { generatePurchaseAnalysis } from "@/lib/ai-analysis";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Cobertura alvo da compra (1 semana + folga) e janela pra estimar o ritmo.
const COBERTURA_DIAS = 8;
const JANELA_DIAS = 60;

export async function analisarCompras(): Promise<{ text?: string; error?: string }> {
  await requirePermission("canManageEstoque");

  try {
    const agora = new Date();
    const ha7 = new Date(agora.getTime() - 7 * 86_400_000);
    const janela = new Date(agora.getTime() - JANELA_DIAS * 86_400_000);

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
        where: { createdAt: { gte: janela } },
        select: { ingredientId: true, type: true, quantity: true, createdAt: true },
      }),
    ]);

    // Por ingrediente: total de saídas e de compras (entradas) na janela, e a
    // saída dos últimos 7 dias (pra pegar aceleração recente).
    type Agg = { saida: number; entrada: number; saida7: number };
    const agg = new Map<string, Agg>();
    for (const m of movs) {
      const a = agg.get(m.ingredientId) ?? { saida: 0, entrada: 0, saida7: 0 };
      const q = Number(m.quantity);
      if (m.type === "SAIDA") {
        a.saida += q;
        if (m.createdAt >= ha7) a.saida7 += q;
      } else {
        a.entrada += q;
      }
      agg.set(m.ingredientId, a);
    }

    const comprar: string[] = [];
    const estoqueAlto: string[] = [];

    for (const ing of ingredientes) {
      if (ing.isProduced) continue; // produzido é fabricado, não comprado
      const estoque = Number(ing.currentStock);
      const min = Number(ing.minStock);
      const a = agg.get(ing.id);

      const semanaSaida = a ? (a.saida * 7) / JANELA_DIAS : 0;
      const semanaCompra = a ? (a.entrada * 7) / JANELA_DIAS : 0;
      const semanaSaida7 = a ? a.saida7 : 0;
      // Ritmo semanal = o maior entre o que sai, o que se compra e a saída
      // recente — assim não subestima quando a saída não é toda registrada.
      const ritmoSemana = Math.max(semanaSaida, semanaCompra, semanaSaida7);
      const diaria = ritmoSemana / 7;
      const duraDias = diaria > 0 ? estoque / diaria : Infinity;

      if (ritmoSemana > 0) {
        const alvo = diaria * COBERTURA_DIAS;
        const sugestao = Math.max(0, alvo - estoque);
        const base =
          semanaCompra >= semanaSaida && semanaCompra > 0
            ? `compra ~${n(semanaCompra)}/sem`
            : `consumo ~${n(semanaSaida || semanaSaida7)}/sem`;
        if (sugestao > 0.001) {
          comprar.push(
            `- ${ing.name} (${ing.unit}): comprar ~${n(sugestao)} · estoque ${n(estoque)} (dura ~${duraDias === Infinity ? "∞" : Math.round(duraDias)} dias) · ${base}`,
          );
        } else if (duraDias > 21) {
          estoqueAlto.push(
            `- ${ing.name} (${ing.unit}): estoque ${n(estoque)} dura ~${Math.round(duraDias)} dias · ${base}`,
          );
        }
      } else if (estoque < min) {
        comprar.push(
          `- ${ing.name} (${ing.unit}): comprar ~${n(Math.max(min - estoque, 0))} · estoque ${n(estoque)} · abaixo do mínimo (${n(min)}) · sem movimento registrado`,
        );
      }
    }

    if (comprar.length === 0 && estoqueAlto.length === 0) {
      return {
        text: "Ainda não há movimento suficiente (compras ou saídas) pra estimar o consumo. Registre as entradas/saídas de estoque que a IA passa a montar a lista pelo seu ritmo.",
      };
    }

    const linhas: string[] = [];
    linhas.push(
      `Ritmo estimado pelo movimento dos últimos ${JANELA_DIAS} dias (o maior entre o que sai e o que você compra por semana). Cobertura alvo: ~${COBERTURA_DIAS} dias (1 semana com folga). "comprar ~X" já é o que falta pra durar esse período.`,
    );
    linhas.push("\nCOMPRA SUGERIDA (durar ~1 semana pelo seu ritmo):");
    linhas.push(comprar.length ? comprar.join("\n") : "(nenhum)");
    linhas.push("\nESTOQUE ALTO vs ritmo (dinheiro parado — NÃO precisa comprar):");
    linhas.push(estoqueAlto.length ? estoqueAlto.slice(0, 40).join("\n") : "(nenhum)");

    const text = await generatePurchaseAnalysis(linhas.join("\n"));
    return { text };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao gerar a análise." };
  }
}
