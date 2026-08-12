import { XMLParser } from "fast-xml-parser";

export type NfeItem = {
  description: string;
  unit: string | null;
  quantity: number;
  unitValue: number;
  total: number;
};

export type NfeParsed = {
  numero: string | null;
  fornecedor: string | null;
  chave: string | null;
  emissao: string | null; // YYYY-MM-DD
  total: number;
  items: NfeItem[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Lê o XML de uma NFe (nota de compra) e extrai os itens, fornecedor, número,
 * data e total. Tolerante a variações (com/sem nfeProc, campos ausentes).
 */
export function parseNfeXml(xml: string): NfeParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
  });
  const root = parser.parse(xml) as Record<string, unknown>;

  // Caminho: (nfeProc.)NFe.infNFe
  const proc = (root.nfeProc ?? root) as Record<string, unknown>;
  const nfe = (proc.NFe ?? proc) as Record<string, unknown>;
  const infNFe = (nfe.infNFe ?? {}) as Record<string, unknown>;
  if (!infNFe || Object.keys(infNFe).length === 0) {
    throw new Error("XML não parece ser uma NFe válida.");
  }

  const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
  const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
  const totalNode = ((infNFe.total ?? {}) as Record<string, unknown>).ICMSTot as
    | Record<string, unknown>
    | undefined;

  const chaveRaw = String((infNFe as Record<string, string>)["@_Id"] ?? "");
  const chave = chaveRaw.replace(/^NFe/, "") || null;

  const dhEmi = String(ide.dhEmi ?? ide.dEmi ?? "");
  const emissao = dhEmi ? dhEmi.slice(0, 10) : null;

  const dets = asArray(infNFe.det as unknown);
  const items: NfeItem[] = dets.map((detRaw) => {
    const det = (detRaw ?? {}) as Record<string, unknown>;
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const quantity = num(prod.qCom);
    const unitValue = num(prod.vUnCom);
    const total = num(prod.vProd) || quantity * unitValue;
    return {
      description: String(prod.xProd ?? "").trim() || "(sem descrição)",
      unit: prod.uCom ? String(prod.uCom).trim().toUpperCase() : null,
      quantity,
      unitValue,
      total,
    };
  });

  return {
    numero: ide.nNF ? String(ide.nNF) : null,
    fornecedor: emit.xNome ? String(emit.xNome).trim() : null,
    chave,
    emissao,
    total: totalNode ? num(totalNode.vNF) : items.reduce((s, i) => s + i.total, 0),
    items,
  };
}
