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
async function analisar(system: string, user: string, maxTokens = 1500): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "A IA ainda não está ativada. Configure a chave ANTHROPIC_API_KEY pra usar as análises.",
    );
  }
  const client = new Anthropic();
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text || "Não consegui gerar a análise dessa vez. Tente de novo.";
}

export async function generateBusinessAnalysis(
  contextTitle: string,
  dataSummary: string,
): Promise<string> {
  return analisar(
    `Você é um consultor de negócios de uma rede de pizzarias no Brasil, falando direto com o dono, que não é técnico e prefere textos curtos.

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
    `${contextTitle}\n\n${dataSummary}`,
  );
}

/**
 * Análise de compras/estoque: olha o consumo (saídas) da semana e o estoque
 * atual e sugere o que comprar e quanto, SEM comprar demais (evita dinheiro
 * parado e perda por validade).
 */
export async function generatePurchaseAnalysis(dataSummary: string): Promise<string> {
  return analisar(
    `Você é um especialista em COMPRAS e ESTOQUE de uma pizzaria no Brasil, falando com o dono (não técnico, prefere textos curtos). Seu objetivo é ele NÃO perder dinheiro: comprar o suficiente pra não faltar, mas SEM comprar demais (evitar dinheiro parado e perda por validade).

Com base no consumo semanal (saídas) e no estoque atual de cada insumo, escreva em português, com estas seções:

🛒 COMPRAR ESTA SEMANA
- um item por linha: NOME — QUANTIDADE sugerida (com a unidade) — motivo curto (ex: "estoque acaba em ~3 dias")

⚠️ CUIDADO — COMPRANDO DEMAIS / ESTOQUE PARADO
- itens com estoque muito acima do consumo, ou que foram comprados além do necessário (dinheiro parado / risco de perder)

✅ EQUILIBRADO
- 1 ou 2 linhas do que está no ponto certo

Regras:
- Na seção COMPRAR, inclua TODOS os itens marcados como "faltando" (abaixo do mínimo/ideal), com quantidade PELO MENOS igual ao "falta" informado. Se o consumo indicar que vai acabar antes, aumente a quantidade.
- Não deixe de fora nenhum item que está faltando.
- Um item com estoque ok e sem saída NÃO entra em COMPRAR.
- Cite números reais (consumo/semana, estoque atual, quanto falta). Não invente insumos.
- Sem introdução nem despedida. Curto e direto.`,
    dataSummary,
    2000,
  );
}
