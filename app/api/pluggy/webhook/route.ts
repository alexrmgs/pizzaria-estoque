import { NextResponse } from "next/server";

// Endpoint público de webhooks da Pluggy (Open Finance). A Pluggy exige um
// endpoint não-localhost cobrindo os eventos item/created, item/updated,
// transactions/created, transactions/updated, transactions/deleted (ou "all")
// pra liberar o acesso à produção. Como o sistema consulta saldo/extrato ao
// vivo, aqui só confirmamos o recebimento (200) — dá pra evoluir depois pra
// guardar/atualizar dados a partir dos eventos.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log("[pluggy-webhook]", JSON.stringify(body).slice(0, 500));
  } catch {
    // ignora corpo inválido
  }
  return NextResponse.json({ received: true });
}

// A Pluggy pode fazer um GET pra validar o endpoint.
export async function GET() {
  return NextResponse.json({ ok: true });
}
