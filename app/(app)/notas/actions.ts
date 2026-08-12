"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { parseNfeXml } from "@/lib/nfe";
import { getAppSettings } from "@/lib/settings";
import { focusConfigured, listarRecebidas, baixarXmlRecebida } from "@/lib/focusnfe";

function weightedAveragePrice(
  currentStock: number,
  currentPrice: number,
  incomingQuantity: number,
  incomingPrice: number,
): number {
  const totalQuantity = currentStock + incomingQuantity;
  if (totalQuantity <= 0) return incomingPrice;
  const blended = (currentStock * currentPrice + incomingQuantity * incomingPrice) / totalQuantity;
  return Math.round(blended * 100) / 100;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Tenta casar a descrição do item da nota com um ingrediente já cadastrado.
function matchIngredient(
  description: string,
  ingredients: { id: string; name: string }[],
): string | null {
  const d = normalize(description);
  if (!d) return null;
  // 1) nome do ingrediente contido na descrição (ou vice-versa)
  for (const ing of ingredients) {
    const n = normalize(ing.name);
    if (n.length >= 3 && (d.includes(n) || n.includes(d))) return ing.id;
  }
  // 2) primeira palavra em comum relevante
  const words = d.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  for (const ing of ingredients) {
    const n = normalize(ing.name);
    if (words.some((w) => n.includes(w))) return ing.id;
  }
  return null;
}

export type NotaItemInput = {
  description: string;
  unit?: string | null;
  quantity: number;
  unitValue: number;
  total: number;
  ingredientId?: string | null;
};

export type NotaHeaderInput = {
  numero?: string | null;
  fornecedor?: string | null;
  emissao?: string | null;
  boleto: boolean;
  vencimento?: string | null;
  total: number;
};

export async function criarNotaDeXml(xmlText: string): Promise<{ id?: string; error?: string }> {
  const user = await requirePermission("canManageEstoque");
  let parsed;
  try {
    parsed = parseNfeXml(xmlText);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não consegui ler o XML." };
  }
  if (parsed.items.length === 0) return { error: "A nota não tem itens." };

  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });

  const nota = await prisma.notaFiscal.create({
    data: {
      numero: parsed.numero,
      fornecedor: parsed.fornecedor,
      chave: parsed.chave,
      emissao: parsed.emissao ? new Date(`${parsed.emissao}T00:00:00Z`) : null,
      total: parsed.total,
      userId: user.id,
      items: {
        create: parsed.items.map((it) => ({
          description: it.description,
          unit: it.unit,
          quantity: it.quantity,
          unitValue: it.unitValue,
          total: it.total,
          ingredientId: matchIngredient(it.description, ingredients),
        })),
      },
    },
  });
  revalidatePath("/notas");
  return { id: nota.id };
}

export type SyncRecebidasResult = {
  error?: string;
  novas?: number;
  semXml?: number;
  configurado?: boolean;
};

/**
 * Puxa da Focus NFe as notas emitidas contra o CNPJ (compras). Cada nota nova
 * vira uma NotaFiscal em CONFERINDO — com os itens quando o XML completo está
 * disponível, ou só o cabeçalho quando ainda não (aí precisa dar ciência).
 */
export async function sincronizarRecebidas(): Promise<SyncRecebidasResult> {
  const user = await requirePermission("canManageEstoque");
  if (!focusConfigured()) {
    return { configurado: false, error: "Integração Focus NFe não configurada." };
  }

  const settings = await getAppSettings();
  let versao = settings.focusUltimaVersao ?? 0;
  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });

  let novas = 0;
  let semXml = 0;
  try {
    // Pagina até acabar (até 100 por vez); teto de 20 páginas por segurança.
    for (let page = 0; page < 20; page++) {
      const { notas, maxVersion } = await listarRecebidas(versao);
      if (notas.length === 0) break;

      for (const nota of notas) {
        const chave = nota.chave_nfe;
        if (!chave) continue;
        const existe = await prisma.notaFiscal.findFirst({ where: { chave } });
        if (existe) continue;

        const emissao = nota.data_emissao ? new Date(nota.data_emissao) : null;
        const total = nota.valor_total ? Number(nota.valor_total) : 0;

        if (nota.nfe_completa) {
          try {
            const xml = await baixarXmlRecebida(chave);
            const parsed = parseNfeXml(xml);
            await prisma.notaFiscal.create({
              data: {
                numero: parsed.numero,
                fornecedor: parsed.fornecedor ?? nota.nome_emitente ?? null,
                chave,
                emissao: parsed.emissao ? new Date(`${parsed.emissao}T00:00:00Z`) : emissao,
                total: parsed.total || total,
                userId: user.id,
                items: {
                  create: parsed.items.map((it) => ({
                    description: it.description,
                    unit: it.unit,
                    quantity: it.quantity,
                    unitValue: it.unitValue,
                    total: it.total,
                    ingredientId: matchIngredient(it.description, ingredients),
                  })),
                },
              },
            });
            novas++;
            continue;
          } catch {
            // se o XML falhar, cai no cadastro só de cabeçalho abaixo
          }
        }

        // Sem XML completo: guarda só o cabeçalho pra referência.
        await prisma.notaFiscal.create({
          data: {
            fornecedor: nota.nome_emitente ?? null,
            chave,
            emissao,
            total,
            userId: user.id,
          },
        });
        semXml++;
      }

      if (maxVersion <= versao) break;
      versao = maxVersion;
    }

    await prisma.appSettings.update({
      where: { id: "settings" },
      data: { focusUltimaVersao: versao },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao consultar a Focus NFe." };
  }

  revalidatePath("/notas");
  return { novas, semXml, configurado: true };
}

export async function criarNotaManual(): Promise<{ id?: string; error?: string }> {
  const user = await requirePermission("canManageEstoque");
  const nota = await prisma.notaFiscal.create({ data: { userId: user.id } });
  revalidatePath("/notas");
  return { id: nota.id };
}

async function salvar(notaId: string, header: NotaHeaderInput, items: NotaItemInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.notaFiscalItem.deleteMany({ where: { notaId } });
    await tx.notaFiscal.update({
      where: { id: notaId },
      data: {
        numero: header.numero || null,
        fornecedor: header.fornecedor || null,
        emissao: header.emissao ? new Date(`${header.emissao}T00:00:00Z`) : null,
        boleto: header.boleto,
        vencimento: header.vencimento ? new Date(`${header.vencimento}T00:00:00Z`) : null,
        total: header.total,
        items: {
          create: items.map((it) => ({
            description: it.description || "(sem descrição)",
            unit: it.unit || null,
            quantity: it.quantity,
            unitValue: it.unitValue,
            total: it.total,
            ingredientId: it.ingredientId || null,
          })),
        },
      },
    });
  });
}

export async function salvarRascunho(
  notaId: string,
  header: NotaHeaderInput,
  items: NotaItemInput[],
): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  await salvar(notaId, header, items);
  revalidatePath(`/notas/${notaId}`);
  revalidatePath("/notas");
  return {};
}

export async function lancarNota(
  notaId: string,
  header: NotaHeaderInput,
  items: NotaItemInput[],
): Promise<{ error?: string }> {
  const user = await requirePermission("canManageEstoque");

  const nota = await prisma.notaFiscal.findUnique({ where: { id: notaId } });
  if (!nota) return { error: "Nota não encontrada." };
  if (nota.status === "LANCADA") return { error: "Essa nota já foi lançada." };

  const comProduto = items.filter((it) => it.ingredientId && it.quantity > 0);
  if (comProduto.length === 0) {
    return { error: "Nenhum item foi casado com um produto do estoque." };
  }

  await salvar(notaId, header, items);

  try {
    await prisma.$transaction(async (tx) => {
      for (const it of comProduto) {
        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: it.ingredientId! } });
        const current = Number(ing.currentStock);
        await tx.stockMovement.create({
          data: {
            ingredientId: it.ingredientId!,
            type: "ENTRADA",
            quantity: it.quantity,
            reason: `NF ${header.numero ?? ""} ${header.fornecedor ?? ""}`.trim() || "Nota fiscal",
            userId: user.id,
            unitPriceAtEntry: it.unitValue || Number(ing.unitPrice),
          },
        });
        const newPrice =
          it.unitValue > 0
            ? weightedAveragePrice(current, Number(ing.unitPrice), it.quantity, it.unitValue)
            : undefined;
        await tx.ingredient.update({
          where: { id: it.ingredientId! },
          data: {
            currentStock: { increment: it.quantity },
            ...(newPrice !== undefined ? { unitPrice: newPrice } : {}),
          },
        });
      }

      let payableId: string | null = null;
      if (header.boleto) {
        const due = header.vencimento || header.emissao || new Date().toISOString().slice(0, 10);
        const payable = await tx.payable.create({
          data: {
            description: `NF ${header.numero ?? ""} ${header.fornecedor ?? ""}`.trim() || "Nota fiscal",
            category: "Fornecedor",
            amount: header.total,
            dueDate: new Date(`${due}T00:00:00Z`),
            status: "PENDENTE",
            note: "Gerada pela nota fiscal de entrada",
            userId: user.id,
          },
        });
        payableId = payable.id;
      }

      await tx.notaFiscal.update({
        where: { id: notaId },
        data: { status: "LANCADA", payableId },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao lançar a nota." };
  }

  revalidatePath(`/notas/${notaId}`);
  revalidatePath("/notas");
  revalidatePath("/estoque");
  revalidatePath("/movimentacoes");
  revalidatePath("/caixa");
  return {};
}

export async function excluirNota(notaId: string): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  await prisma.notaFiscal.delete({ where: { id: notaId } });
  revalidatePath("/notas");
  return {};
}
