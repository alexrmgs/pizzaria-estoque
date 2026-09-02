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
// A Pluggy não assina o payload — mas dá pra configurar um header próprio na
// hora de cadastrar o webhook (campo "headers" na criação). Sem isso
// configurado do lado da Pluggy, qualquer um na internet podia chamar esse
// endpoint e forçar o servidor a testar as credenciais de TODAS as lojas
// contra um itemId à escolha (gasta cota, e pode até religar uma conexão já
// existente pra outra loja). Falha fechado se o segredo não bater.
function isValidWebhookSecret(request: Request): boolean {
  const expected = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("x-webhook-secret") === expected;
}

export async function POST(request: Request) {
  if (!isValidWebhookSecret(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    console.log("[pluggy-webhook]", JSON.stringify(body).slice(0, 500));

    const event = typeof body.event === "string" ? body.event : "";
    const itemId =
      (typeof body.itemId === "string" && body.itemId) ||
      (typeof body.id === "string" && event.startsWith("item") && body.id) ||
      "";

    if (event.startsWith("item") && itemId) {
      const existente = await prisma.bankConnection.findUnique({ where: { itemId } });

      // Conexão já vinculada a uma loja: só atualiza o nome (via as
      // credenciais dela mesma), nunca troca de loja por um evento de
      // webhook — só `salvarConexao` (autenticado) pode religar.
      if (existente?.storeId) {
        const store = await prisma.store.findUnique({
          where: { id: existente.storeId },
          select: { pluggyClientId: true, pluggyClientSecret: true },
        });
        const creds = resolvePluggyCreds(store);
        if (creds) {
          try {
            const item = await getItem(creds, itemId);
            if (item.connector?.name) {
              await prisma.bankConnection.update({
                where: { itemId },
                data: { name: item.connector.name },
              });
            }
          } catch {
            // conexão pode ter sido revogada do lado da Pluggy; ignora
          }
        }
        return NextResponse.json({ received: true });
      }

      // Conexão nova (sem loja vinculada ainda): testa as credenciais de
      // cada loja até achar uma que reconheça esse itemId.
      const stores = await prisma.store.findMany({
        select: { id: true, pluggyClientId: true, pluggyClientSecret: true },
      });
      let storeId: string | null = null;
      let name: string | null = null;
      for (const store of stores) {
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
