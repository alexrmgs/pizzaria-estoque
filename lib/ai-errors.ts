import Anthropic from "@anthropic-ai/sdk";

/** Troca os erros da API da Anthropic por um aviso em português que o dono entende. */
export function erroIA(e: unknown): Error {
  if (e instanceof Anthropic.APIError) {
    const msg = e.message ?? "";
    if (/credit balance is too low/i.test(msg)) {
      return new Error(
        "Acabou o crédito da IA. Coloque crédito em console.anthropic.com → Plans & Billing e tente de novo.",
      );
    }
    if (e.status === 401) return new Error("A chave da IA (ANTHROPIC_API_KEY) está inválida.");
    if (e.status === 429 || e.status === 529) {
      return new Error("A IA está sobrecarregada agora. Espere um minuto e tente de novo.");
    }
  }
  return e instanceof Error ? e : new Error("Falha ao falar com a IA.");
}
