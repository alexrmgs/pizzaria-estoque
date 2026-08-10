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

const CHUNK_DAYS = 7;

export function SaiposSync({ stores }: { stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [start, setStart] = useState(isoDaysAgo(7));
  const [end, setEnd] = useState(isoDaysAgo(0));
  // Estado simples (sem useTransition) pra não congelar a página e mostrar o
  // progresso a cada pedaço em tempo real.
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState("");

  async function puxar() {
    if (end < start) {
      toast.error("A data final não pode ser antes da inicial.");
      return;
    }
    const ranges = chunkRanges(start, end, CHUNK_DAYS);
    setLoading(true);
    let dias = 0;
    let pedidos = 0;
    let total = 0;
    try {
      for (let i = 0; i < ranges.length; i++) {
        const [rStart, rEnd] = ranges[i];
        setProgresso(
          `Puxando ${i + 1} de ${ranges.length}… (${total > 0 ? currency(total) : "R$ 0,00"} até agora)`,
        );
        const result = await sincronizarSaipos({ storeId, start: rStart, end: rEnd });
        if (result.error) {
          toast.error(`Erro no pedaço ${rStart} a ${rEnd}: ${result.error}`);
          router.refresh();
          return;
        }
        dias += result.dias ?? 0;
        pedidos += result.pedidos ?? 0;
        total += result.total ?? 0;
      }
      if (dias === 0) {
        toast.info("Nenhuma venda encontrada nesse período.");
        return;
      }
      toast.success(
        `Faturamento importado: ${dias} dia(s), ${pedidos} pedido(s), ${currency(total)} ✅`,
      );
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
      </CardContent>
    </Card>
  );
}
