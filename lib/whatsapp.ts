const GRAPH_API_VERSION = "v21.0";

/** Manda uma mensagem de texto simples pra um número via WhatsApp Cloud API. */
export async function sendWhatsappMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN não configurados.");
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar mensagem WhatsApp (${res.status}): ${body}`);
  }
}

export type WhatsappIncomingMessage = {
  from: string;
  text: string;
};

/** Extrai a primeira mensagem de texto de um payload de webhook da Cloud API,
 * ou null se o evento não for uma mensagem de texto (ex: confirmação de
 * entrega, status, mídia). */
export function parseWhatsappWebhookPayload(payload: unknown): WhatsappIncomingMessage | null {
  const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
    | { changes?: unknown[] }
    | undefined;
  const change = entry?.changes?.[0] as { value?: unknown } | undefined;
  const value = change?.value as
    | { messages?: { from?: string; type?: string; text?: { body?: string } }[] }
    | undefined;
  const message = value?.messages?.[0];
  if (!message || message.type !== "text" || !message.text?.body || !message.from) {
    return null;
  }
  return { from: message.from, text: message.text.body };
}
