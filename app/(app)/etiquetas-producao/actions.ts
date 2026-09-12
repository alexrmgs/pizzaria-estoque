"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProducaoAccess } from "@/lib/dal";

/**
 * Apaga da fila de impressão (PrintJob) as etiquetas de produção que ainda
 * não foram impressas — pra destravar quando ficam acumuladas sem o
 * agente/impressora da loja processar.
 */
export async function limparFilaProducao(): Promise<{ error?: string; apagados?: number }> {
  await requireProducaoAccess();
  const result = await prisma.printJob.deleteMany({
    where: { tipo: "PRODUCAO", status: "PENDENTE" },
  });
  revalidatePath("/etiquetas-producao");
  return { apagados: result.count };
}
