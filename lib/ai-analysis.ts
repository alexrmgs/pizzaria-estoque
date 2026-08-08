import Anthropic from "@anthropic-ai/sdk";

/** Modelo usado nas análises. Trocar aqui se quiser algo mais barato
 * (ex: "claude-haiku-4-5") ou mais capaz. */
const AI_MODEL = "claude-opus-5";

/**
 * Manda um resumo de dados do sistema pra Claude e recebe de volta uma
 * análise curta em português, com o que está indo bem, o que precisa de
 * atenção e recomendações práticas. Se a chave da API não estiver
 * configurada, avisa de forma amigável em vez de quebrar.
 */
export async function generateBusinessAnalysis(
  contextTitle: string,
  dataSummary: string,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "A IA ainda não está ativada. Configure a chave ANTHROPIC_API_KEY pra usar as análises.",
    );
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: AI_MODEL,
    // Resposta curta de propósito — o dono odeia ler textão. Análise objetiva
    // em bullets cabe bem abaixo desse limite.
    max_tokens: 1500,
    system: `Você é um consultor de negócios de uma rede de pizzarias no Brasil, falando direto com o dono, que não é técnico e prefere textos curtos.

A partir dos dados que ele te manda, escreva uma análise objetiva em português, com estas três seções, cada uma com 2 a 4 bullets curtos:

✅ O QUE ESTÁ INDO BEM
⚠️ PONTOS DE ATENÇÃO
💡 RECOMENDAÇÕES

Regras:
- Seja específico: cite números, lojas, canais e receitas pelos nomes que aparecem nos dados.
- Recomendações devem ser ações concretas ("suba o preço da pizza X em ~8%", "invista mais no iFood da FB Eusébio"), não conselhos genéricos.
- Não invente dados que não estão no resumo.
- Sem introdução nem despedida. Comece direto na primeira seção.
- Linguagem simples e direta, sem jargão.`,
    messages: [{ role: "user", content: `${contextTitle}\n\n${dataSummary}` }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || "Não consegui gerar a análise dessa vez. Tente de novo.";
}
