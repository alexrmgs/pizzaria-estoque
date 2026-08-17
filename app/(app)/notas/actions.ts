"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { parseNfeXml } from "@/lib/nfe";
import { extrairCupom } from "@/lib/ai-cupom";
import { todayInBrazil } from "@/lib/payroll";
import {
  focusConfigured,
  listarRecebidas,
  baixarXmlRecebida,
  manifestarCiencia,
} from "@/lib/focusnfe";

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
  // Quantidade que REALMENTE entra no estoque, já na unidade do estoque (ex: a
  // nota veio "2 CX" mas entra "20 kg" -> qtdEstoque = 20). O usuário digita
  // direto, sem multiplicar. Guardada na coluna `fator` do banco.
  qtdEstoque?: number;
};

export type NotaHeaderInput = {
  numero?: string | null;
  fornecedor?: string | null;
  emissao?: string | null;
  boleto: boolean;
  vencimento?: string | null;
  jaPago: boolean;
  formaPagamento?: "DINHEIRO" | "PIX" | null;
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
          fator: it.quantity, // qtd no estoque começa igual à qtd da nota
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
  manifestadas?: number;
  configurado?: boolean;
};

/**
 * Puxa da Focus NFe as notas emitidas contra o CNPJ (compras). Quando o XML
 * completo existe, cria/completa a NotaFiscal com os itens; quando a nota veio
 * só como resumo, manifesta CIÊNCIA (libera o XML completo) e a próxima puxada
 * traz os itens. Reprocessa sempre (versao=0) pra completar as antigas.
 */
export async function sincronizarRecebidas(): Promise<SyncRecebidasResult> {
  const user = await requirePermission("canManageEstoque");
  if (!focusConfigured()) {
    return { configurado: false, error: "Integração Focus NFe não configurada." };
  }

  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });

  let novas = 0;
  let semXml = 0;
  let manifestadas = 0;
  try {
    let versao = 0;
    for (let page = 0; page < 20; page++) {
      const { notas, maxVersion } = await listarRecebidas(versao);
      if (notas.length === 0) break;

      for (const nota of notas) {
        const chave = nota.chave_nfe;
        if (!chave) continue;

        const existe = await prisma.notaFiscal.findFirst({
          where: { chave },
          select: { id: true, status: true, _count: { select: { items: true } } },
        });
        // Já resolvida (lançada ou já com itens) → não mexe.
        if (existe && (existe.status === "LANCADA" || existe._count.items > 0)) continue;

        const emissao = nota.data_emissao ? new Date(nota.data_emissao) : null;
        const total = nota.valor_total ? Number(nota.valor_total) : 0;

        if (nota.nfe_completa) {
          try {
            const xml = await baixarXmlRecebida(chave);
            const parsed = parseNfeXml(xml);
            const dados = {
              numero: parsed.numero,
              fornecedor: parsed.fornecedor ?? nota.nome_emitente ?? null,
              chave,
              emissao: parsed.emissao ? new Date(`${parsed.emissao}T00:00:00Z`) : emissao,
              total: parsed.total || total,
              userId: user.id,
            };
            const itemsData = parsed.items.map((it) => ({
              description: it.description,
              unit: it.unit,
              quantity: it.quantity,
              unitValue: it.unitValue,
              total: it.total,
              ingredientId: matchIngredient(it.description, ingredients),
              fator: it.quantity, // qtd no estoque começa igual à qtd da nota
            }));

            if (existe) {
              // Completa a nota que estava só com cabeçalho.
              await prisma.$transaction([
                prisma.notaFiscalItem.deleteMany({ where: { notaId: existe.id } }),
                prisma.notaFiscal.update({
                  where: { id: existe.id },
                  data: { ...dados, items: { create: itemsData } },
                }),
              ]);
            } else {
              await prisma.notaFiscal.create({ data: { ...dados, items: { create: itemsData } } });
            }
            novas++;
            continue;
          } catch {
            // se o XML falhar, cai no cadastro/manifestação abaixo
          }
        }

        // Só resumo: cria o cabeçalho (se novo) e manifesta ciência pra liberar
        // o XML completo na próxima puxada.
        if (!existe) {
          await prisma.notaFiscal.create({
            data: { fornecedor: nota.nome_emitente ?? null, chave, emissao, total, userId: user.id },
          });
          semXml++;
        }
        const jaManifestada = !!nota.manifestacao_destinatario;
        if (!jaManifestada) {
          try {
            if (await manifestarCiencia(chave)) manifestadas++;
          } catch {
            /* ignora */
          }
        }
      }

      if (maxVersion <= versao) break;
      versao = maxVersion;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao consultar a Focus NFe." };
  }

  revalidatePath("/notas");
  revalidatePath("/movimentacoes");
  return { novas, semXml, manifestadas, configurado: true };
}

export async function criarNotaManual(): Promise<{ id?: string; error?: string }> {
  const user = await requirePermission("canManageEstoque");
  const nota = await prisma.notaFiscal.create({ data: { userId: user.id } });
  revalidatePath("/notas");
  return { id: nota.id };
}

export async function criarNotaDaFoto(input: {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}): Promise<{ id?: string; error?: string }> {
  const user = await requirePermission("canManageEstoque");

  let cupom;
  try {
    cupom = await extrairCupom(input.base64, input.mediaType);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não consegui ler o cupom." };
  }
  if (cupom.items.length === 0) {
    return { error: "Não encontrei itens no cupom. Tente uma foto mais nítida e reta." };
  }

  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });
  const nota = await prisma.notaFiscal.create({
    data: {
      numero: cupom.numero,
      fornecedor: cupom.fornecedor,
      emissao: cupom.emissao ? new Date(`${cupom.emissao}T00:00:00Z`) : null,
      total: cupom.total,
      userId: user.id,
      items: {
        create: cupom.items.map((it) => ({
          description: it.description,
          unit: it.unit,
          quantity: it.quantity,
          unitValue: it.unitValue,
          total: it.total,
          ingredientId: matchIngredient(it.description, ingredients),
          fator: it.quantity, // qtd no estoque começa igual à do cupom
        })),
      },
    },
  });
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
        jaPago: header.jaPago,
        formaPagamento: header.jaPago ? header.formaPagamento || null : null,
        total: header.total,
        items: {
          create: items.map((it) => ({
            description: it.description || "(sem descrição)",
            unit: it.unit || null,
            quantity: it.quantity,
            unitValue: it.unitValue,
            total: it.total,
            ingredientId: it.ingredientId || null,
            // fator guarda a "qtd no estoque" (default = qtd da nota).
            fator: it.qtdEstoque && it.qtdEstoque > 0 ? it.qtdEstoque : it.quantity,
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
      // Nota com fornecedor identificado já marca a entrada sozinha — cria o
      // cadastro do fornecedor na hora se ainda não existir (pelo nome do
      // emitente da NF-e), pra não depender de alguém cadastrar antes.
      const fornecedorNome = header.fornecedor?.trim();
      const supplierId = fornecedorNome
        ? (
            await tx.fornecedor.upsert({
              where: { name: fornecedorNome },
              update: {},
              create: { name: fornecedorNome },
            })
          ).id
        : null;

      for (const it of comProduto) {
        const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: it.ingredientId! } });
        const current = Number(ing.currentStock);
        // Qtd que entra no estoque (o usuário informa direto); custo por unidade
        // do estoque = total da linha ÷ essa quantidade.
        const qtdEstoque = it.qtdEstoque && it.qtdEstoque > 0 ? it.qtdEstoque : it.quantity;
        const custoEstoque = qtdEstoque > 0 ? it.total / qtdEstoque : it.unitValue;
        await tx.stockMovement.create({
          data: {
            ingredientId: it.ingredientId!,
            type: "ENTRADA",
            quantity: qtdEstoque,
            reason: `NF ${header.numero ?? ""} ${header.fornecedor ?? ""}`.trim() || "Nota fiscal",
            userId: user.id,
            unitPriceAtEntry: custoEstoque || Number(ing.unitPrice),
            supplierId,
          },
        });
        const newPrice =
          custoEstoque > 0
            ? weightedAveragePrice(current, Number(ing.unitPrice), qtdEstoque, custoEstoque)
            : undefined;
        await tx.ingredient.update({
          where: { id: it.ingredientId! },
          data: {
            currentStock: { increment: qtdEstoque },
            ...(newPrice !== undefined ? { unitPrice: newPrice } : {}),
          },
        });
      }

      let payableId: string | null = null;
      const descricao =
        `NF ${header.numero ?? ""} ${header.fornecedor ?? ""}`.trim() || "Nota fiscal";
      if (header.boleto) {
        const due = header.vencimento || header.emissao || todayInBrazil().toISOString().slice(0, 10);
        const payable = await tx.payable.create({
          data: {
            description: descricao,
            category: "Fornecedor",
            amount: header.total,
            dueDate: new Date(`${due}T00:00:00Z`),
            status: "PENDENTE",
            note: "Gerada pela nota fiscal de entrada",
            userId: user.id,
            companyId: user.companyId,
          },
        });
        payableId = payable.id;
      } else if (header.jaPago) {
        const pago = header.emissao || todayInBrazil().toISOString().slice(0, 10);
        const payable = await tx.payable.create({
          data: {
            description: descricao,
            category: "Fornecedor",
            amount: header.total,
            dueDate: new Date(`${pago}T00:00:00Z`),
            status: "PAGA",
            paidDate: new Date(`${pago}T00:00:00Z`),
            paymentMethod: header.formaPagamento || null,
            note: "Gerada pela nota fiscal de entrada",
            userId: user.id,
            companyId: user.companyId,
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
  revalidatePath("/fornecedores");
  revalidatePath("/dashboard");
  return {};
}

export async function excluirNota(notaId: string): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  await prisma.notaFiscal.delete({ where: { id: notaId } });
  revalidatePath("/notas");
  return {};
}
