import Anthropic from "@anthropic-ai/sdk";

// Modelo com visão pra ler o cupom (Sonnet 5 dá conta e é mais barato que Opus).
const VISION_MODEL = "claude-sonnet-5";

export type CupomItem = {
  description: string;
  quantity: number;
  unit: string | null;
  unitValue: number;
  total: number;
};

export type CupomParsed = {
  fornecedor: string | null;
  numero: string | null;
  emissao: string | null; // YYYY-MM-DD
  total: number;
  items: CupomItem[];
};

const SYSTEM = `Você lê CUPONS FISCAIS (NFC-e) de compras de uma pizzaria e extrai os itens.
Responda SOMENTE um JSON válido (sem texto antes/depois, sem crases), no formato:
{
  "fornecedor": "nome da loja emitente ou null",
  "numero": "número do cupom ou null",
  "emissao": "AAAA-MM-DD ou null",
  "total": 0,
  "items": [
    { "description": "nome do produto como está no cupom", "quantity": 0, "unit": "UN/KG/CX/PCT ou null", "quantity_unit_hint": "", "unitValue": 0, "total": 0 }
  ]
}
Regras:
- Um objeto por item comprado. Use ponto como separador decimal.
- quantity = quantidade comprada; unitValue = valor unitário; total = valor total do item.
- Se não conseguir ler algum número, use 0. Não invente itens que não estão no cupom.
- Ignore descontos, tributos e linhas que não são produtos.`;

function extrairJson(texto: string): unknown {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("A IA não retornou dados do cupom.");
  return JSON.parse(texto.slice(ini, fim + 1));
}

/** Lê a foto do cupom (base64 sem prefixo) e devolve os itens. */
export async function extrairCupom(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<CupomParsed> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("A IA ainda não está ativada (falta ANTHROPIC_API_KEY).");
  }
  const client = new Anthropic();
  const res = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 2500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Extraia os itens deste cupom no JSON pedido." },
        ],
      },
    ],
  });

  const texto = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const raw = extrairJson(texto) as {
    fornecedor?: string | null;
    numero?: string | number | null;
    emissao?: string | null;
    total?: number | string | null;
    items?: {
      description?: string;
      quantity?: number | string;
      unit?: string | null;
      unitValue?: number | string;
      total?: number | string;
    }[];
  };

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    fornecedor: raw.fornecedor ? String(raw.fornecedor).trim() : null,
    numero: raw.numero != null ? String(raw.numero).trim() : null,
    emissao: raw.emissao && /^\d{4}-\d{2}-\d{2}$/.test(raw.emissao) ? raw.emissao : null,
    total: num(raw.total),
    items: (raw.items ?? []).map((it) => {
      const quantity = num(it.quantity) || 1;
      const unitValue = num(it.unitValue);
      const total = num(it.total) || quantity * unitValue;
      return {
        description: (it.description ?? "").trim() || "(sem descrição)",
        quantity,
        unit: it.unit ? String(it.unit).trim().toUpperCase() : null,
        unitValue,
        total,
      };
    }),
  };
}
