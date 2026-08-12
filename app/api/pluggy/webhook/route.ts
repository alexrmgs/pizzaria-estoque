import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getItem } from "@/lib/pluggy";

// Endpoint público de webhooks da Pluggy (Open Finance). A Pluggy exige um
// endpoint não-localhost cobrindo os eventos item/created, item/updated,
// transactions/* (ou "all") pra liberar o acesso à produção.
//
// Além de confirmar o recebimento (200), quando chega um evento de item
// (conta conectada em qualquer lugar — nosso widget ou meu.pluggy.ai) a gente
// salva o itemId como BankConnection, pra a conta aparecer na tela Bancos.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    console.log("[pluggy-webhook]", JSON.stringify(body).slice(0, 500));

    const event = typeof body.event === "string" ? body.event : "";
    const itemId =
      (typeof body.itemId === "string" && body.itemId) ||
      (typeof body.id === "string" && event.startsWith("item") && body.id) ||
      "";

    if (event.startsWith("item") && itemId) {
      let name: string | null = null;
      try {
        const item = await getItem(itemId);
        name = item.connector?.name ?? null;
      } catch {
        // segue sem o nome
      }
      await prisma.bankConnection.upsert({
        where: { itemId },
        create: { itemId, name },
        update: name ? { name } : {},
      });
    }
  } catch {
    // nunca falha o webhook por erro interno
  }
  return NextResponse.json({ received: true });
}

// A Pluggy pode fazer um GET pra validar o endpoint.
export async function GET() {
  return NextResponse.json({ ok: true });
}
