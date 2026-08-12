// Cliente da API da Focus NFe — módulo "NF-e recebidas" (Distribuição de DFe):
// baixa as notas emitidas contra o CNPJ da empresa. Auth por HTTP Basic com o
// token como usuário (senha vazia). Token na env FOCUS_NFE_TOKEN e o CNPJ da
// empresa em FOCUS_NFE_CNPJ.

const BASE = "https://api.focusnfe.com.br";

export function focusConfigured(): boolean {
  return !!process.env.FOCUS_NFE_TOKEN && !!process.env.FOCUS_NFE_CNPJ;
}

function authHeader(): string {
  const token = process.env.FOCUS_NFE_TOKEN ?? "";
  return "Basic " + Buffer.from(`${token}:`).toString("base64");
}

export type NotaRecebida = {
  chave_nfe: string;
  nome_emitente?: string;
  documento_emitente?: string;
  valor_total?: string;
  data_emissao?: string;
  situacao?: string;
  nfe_completa?: boolean;
  versao?: number;
};

/**
 * Lista as NF-e recebidas com versão MAIOR que `versao` (paginação da Focus:
 * até 100 por vez). Retorna as notas e a maior versão vista (header
 * X-Max-Version) pra continuar de onde parou.
 */
export async function listarRecebidas(
  versao: number,
): Promise<{ notas: NotaRecebida[]; maxVersion: number }> {
  const cnpj = process.env.FOCUS_NFE_CNPJ ?? "";
  const url = `${BASE}/v2/nfes_recebidas?cnpj=${encodeURIComponent(cnpj)}&versao=${versao}`;
  const res = await fetch(url, { headers: { Authorization: authHeader() }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Focus NFe (${res.status}). ${body.slice(0, 200)}`);
  }
  const notas = (await res.json()) as NotaRecebida[];
  const maxHeader = res.headers.get("x-max-version");
  const maxVersion = maxHeader ? parseInt(maxHeader, 10) || versao : versao;
  return { notas: Array.isArray(notas) ? notas : [], maxVersion };
}

/** Baixa o XML completo (nfeProc) de uma nota recebida pela chave. */
export async function baixarXmlRecebida(chave: string): Promise<string> {
  const url = `${BASE}/v2/nfes_recebidas/${encodeURIComponent(chave)}.xml`;
  const res = await fetch(url, { headers: { Authorization: authHeader() }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha ao baixar XML (${res.status}). ${body.slice(0, 150)}`);
  }
  return res.text();
}
