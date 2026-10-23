import { distanceMeters } from "@/lib/geo";

// Taxa de entrega por distância. O ponto do endereço vem do OpenStreetMap
// (Nominatim, grátis, sem chave — limite de 1 consulta/s, sobra pro volume de
// uma pizzaria). A busca fica presa numa caixa em volta da loja, então não
// precisa de cidade no cadastro e não acha "Rua X" de outro estado.

type Ponto = { lat: number; lng: number };
type EnderecoBusca = { logradouro: string; numero?: string | null; bairro?: string | null };

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const CAIXA_GRAUS = 0.35; // ~38 km pra cada lado

async function nominatim(q: string, loja: Ponto): Promise<Ponto | null> {
  const viewbox = [loja.lng - CAIXA_GRAUS, loja.lat + CAIXA_GRAUS, loja.lng + CAIXA_GRAUS, loja.lat - CAIXA_GRAUS].join(",");
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=br&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "fbgestao-pdv/1.0 (+https://fbgestao.com)", "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const [hit] = (await r.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

/**
 * Acha o endereço no mapa. Tenta do mais preciso pro menos: rua + número +
 * bairro → rua + bairro → só o bairro (o centro do bairro já serve pra taxa).
 */
export async function geocodificar(e: EnderecoBusca, loja: Ponto): Promise<(Ponto & { precisao: "rua" | "bairro" }) | null> {
  const rua = e.logradouro.trim();
  const bairro = e.bairro?.trim();
  const tentativas: [string, "rua" | "bairro"][] = [];
  if (e.numero?.trim()) tentativas.push([`${rua}, ${e.numero.trim()}${bairro ? `, ${bairro}` : ""}`, "rua"]);
  tentativas.push([`${rua}${bairro ? `, ${bairro}` : ""}`, "rua"]);
  if (bairro) tentativas.push([bairro, "bairro"]);
  for (const [q, precisao] of tentativas) {
    const p = await nominatim(q, loja);
    if (p) return { ...p, precisao };
  }
  return null;
}

export function distanciaKm(a: Ponto, b: Ponto): number {
  return Math.round((distanceMeters(a.lat, a.lng, b.lat, b.lng) / 1000) * 10) / 10;
}

/** Taxa da primeira faixa que cobre a distância; null = fora da área. */
export function taxaDaFaixa(faixas: { ateKm: number; taxa: number }[], km: number): number | null {
  const f = [...faixas].sort((x, y) => x.ateKm - y.ateKm).find((x) => km <= x.ateKm);
  return f ? f.taxa : null;
}
