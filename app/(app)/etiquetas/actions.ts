"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEtiquetasAccess, requireProducaoAccess, requireImpressaoAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";

export async function enfileirarEtiqueta(
  pedido: string,
  volumes: number,
): Promise<{ error?: string }> {
  await requireEtiquetasAccess();

  const pedidoLimpo = pedido.trim();
  if (!pedidoLimpo) return { error: "Informe o número do pedido." };
  const vol = Math.round(volumes);
  if (!Number.isFinite(vol) || vol < 1 || vol > 50) {
    return { error: "A quantidade de volumes deve ser de 1 a 50." };
  }

  const settings = await getAppSettings();

  await prisma.printJob.create({
    data: {
      pedido: pedidoLimpo,
      volumes: vol,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  return {};
}

export async function enfileirarProducao(
  produto: string,
  producaoISO: string,
  validadeDias: number,
  copias: number,
): Promise<{ error?: string }> {
  await requireProducaoAccess();

  const produtoLimpo = produto.trim();
  if (!produtoLimpo) return { error: "Informe o produto." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(producaoISO)) return { error: "Data de produção inválida." };
  const dias = Math.round(validadeDias);
  if (!Number.isFinite(dias) || dias < 0 || dias > 3650) {
    return { error: "Validade em dias inválida." };
  }
  const qtd = Math.round(copias);
  if (!Number.isFinite(qtd) || qtd < 1 || qtd > 50) {
    return { error: "A quantidade de cópias deve ser de 1 a 50." };
  }

  const producaoData = new Date(`${producaoISO}T00:00:00Z`);
  const validadeData = new Date(producaoData);
  validadeData.setUTCDate(validadeData.getUTCDate() + dias);

  const settings = await getAppSettings();
  await prisma.printJob.create({
    data: {
      tipo: "PRODUCAO",
      produto: produtoLimpo,
      producaoData,
      validadeData,
      copias: qtd,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  return {};
}

export async function reimprimirEtiqueta(id: string): Promise<{ error?: string }> {
  await requireImpressaoAccess();
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return { error: "Etiqueta não encontrada." };

  const settings = await getAppSettings();
  await prisma.printJob.create({
    data: {
      tipo: job.tipo,
      pedido: job.pedido,
      volumes: job.volumes,
      produto: job.produto,
      producaoData: job.producaoData,
      validadeData: job.validadeData,
      copias: job.copias,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  return {};
}
