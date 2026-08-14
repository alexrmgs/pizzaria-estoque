import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getItem, resolvePluggyCreds } from "@/lib/pluggy";

// Endpoint público de webhooks da Pluggy (Open Finance). A Pluggy exige um
// endpoint não-localhost cobrindo os eventos item/created, item/updated,
// transactions/* (ou "all") pra liberar o acesso à produção.
//
// Além de confirmar o recebimento (200), quando chega um evento de item
// (conta conectada em qualquer lugar — nosso widget ou meu.pluggy.ai) a gente
// salva o itemId como BankConnection, pra a conta aparecer na tela Bancos.
//
// Cada loja pode ter seu próprio Client ID/Secret da Pluggy — o webhook não
// diz de qual loja é o evento, então testamos as credenciais de cada loja até
// achar uma que reconheça esse itemId (poucas lojas, custo baixo).
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
      // Já sabe de qual loja é essa conexão? Usa a credencial dela direto.
      const existente = await prisma.bankConnection.findUnique({ where: { itemId } });
      let storeId: string | null = existente?.storeId ?? null;
      let name: string | null = null;

      const stores = await prisma.store.findMany({
        select: { id: true, pluggyClientId: true, pluggyClientSecret: true },
      });
      const candidatas = storeId ? stores.filter((s) => s.id === storeId) : stores;
      for (const store of candidatas) {
        const creds = resolvePluggyCreds(store);
        if (!creds) continue;
        try {
          const item = await getItem(creds, itemId);
          name = item.connector?.name ?? null;
          storeId = store.id;
          break;
        } catch {
          // não era essa loja, tenta a próxima
        }
      }

      await prisma.bankConnection.upsert({
        where: { itemId },
        create: { itemId, name, storeId },
        update: { ...(name ? { name } : {}), ...(storeId ? { storeId } : {}) },
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
