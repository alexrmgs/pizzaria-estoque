"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";

export async function enfileirarEtiqueta(
  pedido: string,
  volumes: number,
): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");

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

export async function reimprimirEtiqueta(id: string): Promise<{ error?: string }> {
  await requirePermission("canManageEstoque");
  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return { error: "Etiqueta não encontrada." };

  const settings = await getAppSettings();
  await prisma.printJob.create({
    data: {
      pedido: job.pedido,
      volumes: job.volumes,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
    },
  });

  revalidatePath("/etiquetas");
  return {};
}
