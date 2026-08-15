"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sincronizarSaipos } from "./saipos-actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Quebra o período em janelas de N dias. Como a API da SaiPos é lenta, cada
// pedaço vira uma chamada curta ao servidor (evita estourar o tempo limite) e
// dá pra mostrar o progresso.
function chunkRanges(startISO: string, endISO: string, days: number): [string, string][] {
  const ranges: [string, string][] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + (days - 1));
    const realEnd = chunkEnd < end ? chunkEnd : end;
    ranges.push([cursor.toISOString().slice(0, 10), realEnd.toISOString().slice(0, 10)]);
    cursor.setUTCDate(cursor.getUTCDate() + days);
  }
  return ranges;
}

// Pedaços pequenos porque a API da SaiPos é lenta e algumas lojas têm muito
// volume (cada chamada curta evita timeout e é reprocessada se falhar).
const CHUNK_DAYS = 3;

export function SaiposSync({ stores }: { stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [start, setStart] = useState(isoDaysAgo(7));
  const [end, setEnd] = useState(isoDaysAgo(0));
  // Estado simples (sem useTransition) pra não congelar a página e mostrar o
  // progresso a cada pedaço em tempo real.
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState("");

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(String(anoAtual - 1));
  const TODAS = "TODAS";
  const [anoStoreId, setAnoStoreId] = useState(TODAS);

  async function puxarPeriodo(
    alvoStoreId: string,
    startISO: string,
    endISO: string,
    onProgresso: (texto: string) => void,
  ): Promise<{ dias: number; pedidos: number; total: number }> {
    const ranges = chunkRanges(startISO, endISO, CHUNK_DAYS);
    let dias = 0;
    let pedidos = 0;
    let total = 0;
    for (let i = 0; i < ranges.length; i++) {
      const [rStart, rEnd] = ranges[i];
      onProgresso(`pedaço ${i + 1}/${ranges.length} (${currency(total)} até agora)`);
      const result = await sincronizarSaipos({ storeId: alvoStoreId, start: rStart, end: rEnd });
      if (result.error) {
        throw new Error(`${rStart} a ${rEnd}: ${result.error}`);
      }
      dias += result.dias ?? 0;
      pedidos += result.pedidos ?? 0;
      total += result.total ?? 0;
    }
    return { dias, pedidos, total };
  }

  async function puxar() {
    if (end < start) {
      toast.error("A data final não pode ser antes da inicial.");
      return;
    }
    setLoading(true);
    try {
      const r = await puxarPeriodo(storeId, start, end, (texto) => setProgresso(texto));
      if (r.dias === 0) {
        toast.info("Nenhuma venda encontrada nesse período.");
        return;
      }
      toast.success(
        `Faturamento importado: ${r.dias} dia(s), ${r.pedidos} pedido(s), ${currency(r.total)} ✅`,
      );
      router.refresh();
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : "falha ao importar"}`);
    } finally {
      setLoading(false);
      setProgresso("");
    }
  }

  // Varredura: puxa o ano inteiro selecionado, loja por loja, todas as lojas
  // com token SaiPos configurado. Demora (pode levar bem mais de 1h no total)
  // — a aba precisa continuar aberta. A SaiPos é instável sob esse volume de
  // chamadas, então um pedaço que falhar (mesmo após os retries do fetch) não
  // aborta a varredura inteira: pula pro próximo e reporta no final.
  async function puxarAnoTodasLojas() {
    const lojasAlvo = anoStoreId === TODAS ? stores : stores.filter((s) => s.id === anoStoreId);
    setLoading(true);
    const yStart = `${ano}-01-01`;
    const yEnd = `${ano}-12-31`;
    let totalGeral = 0;
    let pedidosGeral = 0;
    const falhas: string[] = [];
    try {
      for (let s = 0; s < lojasAlvo.length; s++) {
        const loja = lojasAlvo[s];
        const ranges = chunkRanges(yStart, yEnd, CHUNK_DAYS);
        for (let i = 0; i < ranges.length; i++) {
          const [rStart, rEnd] = ranges[i];
          setProgresso(
            `Loja ${s + 1}/${lojasAlvo.length} (${loja.name}): pedaço ${i + 1}/${ranges.length} (${currency(totalGeral)} até agora)`,
          );
          const result = await sincronizarSaipos({ storeId: loja.id, start: rStart, end: rEnd });
          if (result.error) {
            falhas.push(`${loja.name} ${rStart} a ${rEnd}: ${result.error}`);
            continue;
          }
          totalGeral += result.total ?? 0;
          pedidosGeral += result.pedidos ?? 0;
        }
      }
      if (falhas.length > 0) {
        toast.error(
          `Varredura de ${ano} terminou com ${falhas.length} pedaço(s) sem importar (puxe-os de novo à mão). Ver console.`,
        );
        console.warn("Pedaços que falharam na varredura SaiPos:", falhas);
      } else {
        toast.success(
          `Varredura de ${ano} concluída: ${lojasAlvo.length} loja(s), ${pedidosGeral} pedido(s), ${currency(totalGeral)} ✅`,
        );
      }
      router.refresh();
    } finally {
      setLoading(false);
      setProgresso("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Puxar faturamento da SaiPos
          {stores.length === 1 && (
            <span className="ml-2 text-sm font-normal text-neutral-500">— {stores[0].name}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-neutral-500">
          Importa as vendas do período direto da SaiPos e lança no Financeiro (por dia e por canal —
          loja, iFood e 99). Reimportar o mesmo período substitui os valores.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {stores.length > 1 && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Loja</Label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 w-40"
            />
          </div>
          <Button onClick={puxar} disabled={loading || !storeId} className="h-10">
            <Download className="mr-1 size-4" />
            {loading ? "Puxando…" : "Puxar"}
          </Button>
        </div>
        {progresso && (
          <p className="mt-2 text-xs font-medium text-primary">{progresso}</p>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          Períodos longos são puxados em pedaços de {CHUNK_DAYS} dias (a API da SaiPos é lenta). Pode
          demorar um pouco — não feche a página.
        </p>

        {stores.length > 1 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-semibold">Varredura: ano inteiro</p>
            <p className="mb-3 text-xs text-neutral-500">
              Puxa o ano inteiro da loja escolhida (ou de todas, uma atrás da outra). A API da
              SaiPos é lenta — pode levar mais de 1 hora no total. Deixe a aba aberta até terminar.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Loja</Label>
                <select
                  value={anoStoreId}
                  onChange={(e) => setAnoStoreId(e.target.value)}
                  className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value={TODAS}>Todas as lojas</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Ano</Label>
                <Input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="h-10 w-28"
                />
              </div>
              <Button onClick={puxarAnoTodasLojas} disabled={loading} variant="secondary" className="h-10">
                <Download className="mr-1 size-4" />
                {loading
                  ? "Varrendo…"
                  : anoStoreId === TODAS
                    ? `Puxar ${ano} de todas`
                    : `Puxar ${ano}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
