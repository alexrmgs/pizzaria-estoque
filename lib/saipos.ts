// Cliente da API de Dados da SaiPos (https://saipos-data-api.readme.io).
// Consulta as vendas por período (não é tempo real) pra puxar o faturamento
// diário pro Financeiro. Cada loja tem seu próprio token (Store.saiposToken,
// só o JWT, sem o "Bearer ").

const SAIPOS_BASE = "https://data.saipos.io/v1";
const PAGE_LIMIT = 1000;
const MAX_WINDOW_DAYS = 15; // limite da API por consulta

export type SaiposSale = {
  shift_date: string;
  total_amount: number | string | null;
  canceled: string | null;
  partner_sale: {
    desc_partner_sale?: string | null;
    desc_store_partner?: string | null;
  } | null;
};

function toParam(d: Date, endOfDay = false): string {
  const iso = d.toISOString().slice(0, 10);
  return `${iso}T${endOfDay ? "23:59:59" : "00:00:00"}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(
  token: string,
  startISO: string,
  endISO: string,
  offset: number,
): Promise<SaiposSale[]> {
  const url = new URL(`${SAIPOS_BASE}/search_sales`);
  url.searchParams.set("p_date_column_filter", "shift_date");
  url.searchParams.set("p_filter_date_start", startISO);
  url.searchParams.set("p_filter_date_end", endISO);
  url.searchParams.set("p_limit", String(PAGE_LIMIT));
  url.searchParams.set("p_offset", String(offset));

  // A API da SaiPos às vezes dá 504/timeout de pool sob carga — tenta de novo
  // algumas vezes antes de desistir. Backoff mais longo pq a varredura de ano
  // inteiro martela a API com centenas de chamadas seguidas.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 7; attempt++) {
    if (attempt > 0) await sleep(Math.min(2000 * attempt, 15_000));
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`SaiPos instável (${res.status}). Tentando de novo…`);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`SaiPos respondeu ${res.status}. ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as SaiposSale[];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("A SaiPos não respondeu (tente esse período de novo).");
}

async function fetchWindow(token: string, start: Date, end: Date): Promise<SaiposSale[]> {
  const startISO = toParam(start);
  const endISO = toParam(end, true);
  const all: SaiposSale[] = [];
  let offset = 0;
  // Pagina até vir uma página menor que o limite (fim dos registros).
  for (;;) {
    const page = await fetchPage(token, startISO, endISO, offset);
    all.push(...page);
    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }
  return all;
}

/**
 * Busca todas as vendas do período usando o token da loja, quebrando em janelas
 * de 15 dias (limite da API) e paginando cada uma.
 */
export async function fetchSaiposSales(
  token: string,
  start: Date,
  end: Date,
): Promise<SaiposSale[]> {
  const all: SaiposSale[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + (MAX_WINDOW_DAYS - 1));
    const realEnd = windowEnd < end ? windowEnd : end;
    all.push(...(await fetchWindow(token, cursor, realEnd)));
    cursor.setUTCDate(cursor.getUTCDate() + MAX_WINDOW_DAYS);
  }
  return all;
}

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Descobre o canal a partir do parceiro da venda. iFood, 99Food, Cardápio Web,
 * VoceQpad e Multipedidos mantêm nomes fixos (pra ter cor/rótulo consistente
 * — ver components/channel-badge.tsx); qualquer canal novo que a SaiPos
 * mandar além desses passa direto com o nome real, em vez de cair tudo em
 * "loja própria".
 */
export function saiposChannel(sale: SaiposSale): string {
  const raw = (sale.partner_sale?.desc_partner_sale ?? "").trim();
  const norm = semAcento(raw);
  if (norm.includes("ifood")) return "IFOOD";
  if (norm.includes("99")) return "NOVENTA_NOVE";
  if (norm.includes("cardapio")) return "CARDAPIO_WEB";
  if (norm.includes("voceqpad")) return "VOCE_PEDE";
  if (norm.includes("multipedidos")) return "MULTIPEDIDOS";
  return raw || "LOJA_PROPRIA";
}

/** Loja/marca cadastrada dentro do canal (ex: duas marcas no mesmo iFood).
 * Vazio quando o canal não distingue ("" pra loja própria ou sem essa info). */
export function saiposChannelStore(sale: SaiposSale): string {
  return (sale.partner_sale?.desc_store_partner ?? "").trim();
}
