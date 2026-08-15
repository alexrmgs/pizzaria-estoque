"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEtiquetasAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";

export async function enfileirarEtiqueta(
  pedido: string,
  volumes: number,
): Promise<{ error?: string }> {
  const user = await requireEtiquetasAccess();

  const pedidoLimpo = pedido.trim();
  if (!pedidoLimpo) return { error: "Informe o número do pedido." };
  const vol = Math.round(volumes);
  if (!Number.isFinite(vol) || vol < 1 || vol > 50) {
    return { error: "A quantidade de volumes deve ser de 1 a 50." };
  }

  const settings = await getAppSettings(user.companyId);

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
  impresso?: boolean;
}): Promise<{ error?: string; proximo?: number }> {
  const user = await requireEtiquetasAccess();

  const numero = Math.round(input.numero);
  if (!Number.isFinite(numero) || numero < 1) return { error: "Número do pedido inválido." };
  const vol = Math.round(input.volumes);
  if (!Number.isFinite(vol) || vol < 1 || vol > 50) {
    return { error: "A quantidade de volumes deve ser de 1 a 50." };
  }

  const settings = await getAppSettings(user.companyId);
  // Marca só ESSE número como impresso (some só ele da fila; os outros ficam).
  const impressos = new Set((settings.etiquetaImpressos as unknown as number[]) ?? []);
  impressos.add(numero);

  await prisma.$transaction([
    prisma.printJob.create({
      data: {
        pedido: String(numero),
        cliente: input.cliente?.trim() || null,
        volumes: vol,
        labelWidthMm: settings.labelWidthMm,
        labelHeightMm: settings.labelHeightMm,
        ...(input.impresso ? { status: "IMPRESSO", printedAt: new Date() } : {}),
      },
    }),
    prisma.appSettings.update({
      where: { companyId: user.companyId },
      data: { etiquetaImpressos: [...impressos].sort((a, b) => a - b) },
    }),
  ]);

  revalidatePath("/etiquetas");
  return {};
}

export async function marcarImpresso(id: string): Promise<{ error?: string }> {
  await requireEtiquetasAccess();
  await prisma.printJob.update({
    where: { id },
    data: { status: "IMPRESSO", printedAt: new Date() },
  });
  revalidatePath("/etiquetas");
  return {};
}

export async function limparFilaPedidos(): Promise<{ error?: string; apagados?: number }> {
  await requireEtiquetasAccess();
  const result = await prisma.printJob.deleteMany({
    where: { tipo: "PEDIDO", status: "PENDENTE" },
  });
  revalidatePath("/etiquetas");
  return { apagados: result.count };
}

export async function reimprimirVolume(input: {
  pedido: string;
  volume: number;
  volumes: number;
  cliente?: string;
  impresso?: boolean;
}): Promise<{ error?: string }> {
  const user = await requireEtiquetasAccess();

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

  const settings = await getAppSettings(user.companyId);
  await prisma.printJob.create({
    data: {
      pedido: pedidoLimpo,
      cliente: input.cliente?.trim() || null,
      volumes: total,
      volumeUnico: vol,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
      ...(input.impresso ? { status: "IMPRESSO", printedAt: new Date() } : {}),
    },
  });

  revalidatePath("/etiquetas");
  return {};
}

export async function ajustarProximoNumero(numero: number): Promise<{ error?: string }> {
  const user = await requireEtiquetasAccess();
  const n = Math.round(numero);
  if (!Number.isFinite(n) || n < 1 || n > 9_999_999) return { error: "Número inválido." };
  // Ajustar/resetar começa um ciclo novo — limpa os impressos.
  await getAppSettings(user.companyId); // garante que a linha existe antes do update
  await prisma.appSettings.update({
    where: { companyId: user.companyId },
    data: { etiquetaProximoNumero: n, etiquetaImpressos: [] },
  });
  revalidatePath("/etiquetas");
  return {};
}

