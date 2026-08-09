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

export async function imprimirPedidoAuto(input: {
  numero: number;
  volumes: number;
  cliente?: string;
}): Promise<{ error?: string; proximo?: number }> {
  await requireEtiquetasAccess();

  const numero = Math.round(input.numero);
  if (!Number.isFinite(numero) || numero < 1) return { error: "Número do pedido inválido." };
  const vol = Math.round(input.volumes);
  if (!Number.isFinite(vol) || vol < 1 || vol > 50) {
    return { error: "A quantidade de volumes deve ser de 1 a 50." };
  }

  const settings = await getAppSettings();
  const proximo = Math.max(settings.etiquetaProximoNumero, numero + 1);

  await prisma.$transaction([
    prisma.printJob.create({
      data: {
        pedido: String(numero),
        cliente: input.cliente?.trim() || null,
        volumes: vol,
        labelWidthMm: settings.labelWidthMm,
        labelHeightMm: settings.labelHeightMm,
      },
    }),
    prisma.appSettings.update({
      where: { id: "settings" },
      data: { etiquetaProximoNumero: proximo },
    }),
  ]);

  revalidatePath("/etiquetas");
  return { proximo };
}

export async function reimprimirVolume(input: {
  pedido: string;
  volume: number;
  volumes: number;
  cliente?: string;
}): Promise<{ error?: string }> {
  await requireEtiquetasAccess();

  const pedidoLimpo = input.pedido.trim();
  if (!pedidoLimpo) return { error: "Informe o número do pedido." };
  const total = Math.round(input.volumes);
  const vol = Math.round(input.volume);
  if (!Number.isFinite(total) || total < 1 || total > 50) {
    return { error: "Total de volumes deve ser de 1 a 50." };
  }
  if (!Number.isFinite(vol) || vol < 1 || vol > total) {
    return { error: `O volume deve ser de 1 a ${total}.` };
  }

  const settings = await getAppSettings();
  await prisma.printJob.create({
    data: {
      pedido: pedidoLimpo,
      cliente: input.cliente?.trim() || null,
      volumes: total,
      volumeUnico: vol,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  return {};
}

export async function ajustarProximoNumero(numero: number): Promise<{ error?: string }> {
  await requireEtiquetasAccess();
  const n = Math.round(numero);
  if (!Number.isFinite(n) || n < 1 || n > 9_999_999) return { error: "Número inválido." };
  await prisma.appSettings.update({
    where: { id: "settings" },
    data: { etiquetaProximoNumero: n },
  });
  revalidatePath("/etiquetas");
  return {};
}

export async function enfileirarProducao(input: {
  produto: string;
  producaoISO: string;
  validadeDias: number;
  copias: number;
  temperatura: string;
  responsavel: string;
  peso: string;
}): Promise<{ error?: string }> {
  await requireProducaoAccess();

  const produtoLimpo = input.produto.trim();
  if (!produtoLimpo) return { error: "Informe o produto." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.producaoISO)) return { error: "Data de produção inválida." };
  const dias = Math.round(input.validadeDias);
  if (!Number.isFinite(dias) || dias < 0 || dias > 3650) {
    return { error: "Validade em dias inválida." };
  }
  const qtd = Math.round(input.copias);
  if (!Number.isFinite(qtd) || qtd < 1 || qtd > 50) {
    return { error: "A quantidade de cópias deve ser de 1 a 50." };
  }

  const producaoData = new Date(`${input.producaoISO}T00:00:00Z`);
  const validadeData = new Date(producaoData);
  validadeData.setUTCDate(validadeData.getUTCDate() + dias);

  const settings = await getAppSettings();
  await prisma.printJob.create({
    data: {
      tipo: "PRODUCAO",
      produto: produtoLimpo,
      producaoData,
      validadeData,
      temperatura: input.temperatura.trim() || null,
      responsavel: input.responsavel.trim() || null,
      peso: input.peso.trim() || null,
      copias: qtd,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas-producao");
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
      cliente: job.cliente,
      volumes: job.volumes,
      volumeUnico: job.volumeUnico,
      produto: job.produto,
      producaoData: job.producaoData,
      validadeData: job.validadeData,
      temperatura: job.temperatura,
      responsavel: job.responsavel,
      peso: job.peso,
      copias: job.copias,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  revalidatePath("/etiquetas-producao");
  return {};
}
