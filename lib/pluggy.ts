// Cliente da API da Pluggy (Open Finance). Credenciais na env PLUGGY_CLIENT_ID
// e PLUGGY_CLIENT_SECRET (criadas em dashboard.pluggy.ai). Fluxo:
// 1) POST /auth (clientId+secret) -> apiKey (backend, vale 2h)
// 2) POST /connect_token (X-API-KEY) -> accessToken (front, widget, vale 30min)
// 3) GET /accounts?itemId / GET /transactions?accountId (X-API-KEY)

const BASE = "https://api.pluggy.ai";

export function pluggyConfigured(): boolean {
  return !!process.env.PLUGGY_CLIENT_ID && !!process.env.PLUGGY_CLIENT_SECRET;
}

async function getApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Pluggy não configurado (falta CLIENT_ID/SECRET).");
  }
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy /auth falhou (${res.status}). ${body.slice(0, 150)}`);
  }
  const data = (await res.json()) as { apiKey: string };
  return data.apiKey;
}

async function apiGet<T>(path: string): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-KEY": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy ${path} falhou (${res.status}). ${body.slice(0, 150)}`);
  }
  return (await res.json()) as T;
}

/** Cria o token curto usado pelo widget Pluggy Connect no front. */
export async function createConnectToken(): Promise<string> {
  const apiKey = await getApiKey();
  const res = await fetch(`${BASE}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy /connect_token falhou (${res.status}). ${body.slice(0, 150)}`);
  }
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

export type PluggyAccount = {
  id: string;
  type: string; // BANK | CREDIT
  subtype: string | null;
  name: string;
  marketingName: string | null;
  number: string | null;
  balance: number;
  currencyCode: string;
  bankData?: {
    closingBalance?: number | null;
    automaticallyInvestedBalance?: number | null;
    overdraftContractedLimit?: number | null; // limite de cheque especial
    overdraftUsedLimit?: number | null;
  } | null;
  creditData?: {
    creditLimit?: number | null; // limite total do cartão
    availableCreditLimit?: number | null; // limite ainda disponível
    balanceCloseDate?: string | null;
    balanceDueDate?: string | null;
    minimumPayment?: number | null;
    brand?: string | null;
  } | null;
};

export type PluggyTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
};

export type PluggyItem = {
  id: string;
  status: string;
  connector?: { name?: string };
};

export async function getItem(itemId: string): Promise<PluggyItem> {
  return apiGet<PluggyItem>(`/items/${itemId}`);
}

/** Força a Pluggy a re-sincronizar a conexão com o banco (PATCH /items/{id}). */
export async function atualizarItem(itemId: string): Promise<void> {
  const apiKey = await getApiKey();
  const res = await fetch(`${BASE}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy PATCH /items (${res.status}). ${body.slice(0, 150)}`);
  }
}

export async function getAccounts(itemId: string): Promise<PluggyAccount[]> {
  const data = await apiGet<{ results: PluggyAccount[] }>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
  );
  return data.results ?? [];
}

export async function getTransactions(
  accountId: string,
  monthsBack = 6,
): Promise<PluggyTransaction[]> {
  // v2 usa paginação por cursor: a resposta traz `next` já como querystring
  // (?accountId=...&after=...). Puxa páginas até cobrir ~monthsBack meses (com
  // um teto de páginas pra não pesar), e o filtro fino fica no front.
  const target = new Date();
  target.setMonth(target.getMonth() - monthsBack);
  const targetISO = target.toISOString().slice(0, 10);

  const all: PluggyTransaction[] = [];
  let path = `/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
  for (let page = 0; page < 4; page++) {
    const data = await apiGet<{ results: PluggyTransaction[]; next?: string | null }>(path);
    const results = data.results ?? [];
    all.push(...results);
    const oldest = results[results.length - 1]?.date?.slice(0, 10) ?? "";
    if (!data.next || results.length === 0 || oldest <= targetISO) break;
    path = `/v2/transactions${data.next}`;
  }
  return all;
}
