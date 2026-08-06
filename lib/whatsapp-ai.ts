import Anthropic from "@anthropic-ai/sdk";

export type ParsedMovement =
  | {
      status: "ok";
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      type: "ENTRADA" | "SAIDA";
    }
  | { status: "clarify"; question: string };

/** Usa a Claude API pra interpretar uma mensagem de WhatsApp como uma
 * movimentação de estoque. Se a mensagem for ambígua (ingrediente não
 * identificável, falta quantidade, etc.), pede esclarecimento em vez de
 * adivinhar — quem confirma a interpretação final é sempre o funcionário. */
export async function interpretStockMessage(
  message: string,
  ingredients: { id: string; name: string; unit: string }[],
): Promise<ParsedMovement> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const client = new Anthropic();
  const ingredientList = ingredients.map((i) => `- ${i.name} (${i.unit}) [id: ${i.id}]`).join("\n");

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: `Você ajuda a registrar entradas e saídas de estoque de uma pizzaria a partir de mensagens de WhatsApp de funcionários.

Ingredientes cadastrados:
${ingredientList}

Se a mensagem indicar claramente um ingrediente da lista, uma quantidade e se é entrada ou saída de estoque, use a ferramenta register_stock_movement com o "id" exato do ingrediente.

Se a mensagem estiver ambígua — ingrediente não identificável ou pode ser mais de um item da lista, falta a quantidade, ou não dá pra saber se é entrada ou saída — NÃO use a ferramenta. Responda só com uma pergunta curta e direta pra esclarecer, sem explicações longas.`,
    tools: [
      {
        name: "register_stock_movement",
        description: "Registra a movimentação de estoque identificada na mensagem.",
        input_schema: {
          type: "object",
          properties: {
            ingredientId: {
              type: "string",
              description: "id do ingrediente cadastrado, exatamente como informado na lista",
            },
            quantity: {
              type: "number",
              description: "quantidade, na mesma unidade cadastrada do ingrediente",
            },
            type: { type: "string", enum: ["ENTRADA", "SAIDA"] },
          },
          required: ["ingredientId", "quantity", "type"],
        },
      },
    ],
    messages: [{ role: "user", content: message }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as { ingredientId: string; quantity: number; type: "ENTRADA" | "SAIDA" };
    const ingredient = ingredients.find((i) => i.id === input.ingredientId);
    if (!ingredient || !(input.quantity > 0)) {
      return {
        status: "clarify",
        question: "Não consegui identificar direito. Pode mandar de novo especificando o ingrediente e a quantidade?",
      };
    }
    return {
      status: "ok",
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity: input.quantity,
      type: input.type,
    };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  const question = textBlock && textBlock.type === "text" ? textBlock.text : "Não entendi, pode reformular?";
  return { status: "clarify", question };
}
