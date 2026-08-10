"use client";

import { useState, useTransition } from "react";
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

export function SaiposSync({ stores }: { stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [start, setStart] = useState(isoDaysAgo(7));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [isPending, startTransition] = useTransition();

  function puxar() {
    startTransition(async () => {
      const result = await sincronizarSaipos({ storeId, start, end });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if ((result.dias ?? 0) === 0) {
        toast.info("Nenhuma venda encontrada nesse período.");
        return;
      }
      toast.success(
        `Faturamento importado: ${result.dias} dia(s), ${result.pedidos} pedido(s), ${currency(result.total ?? 0)} ✅`,
      );
      router.refresh();
    });
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
          <Button onClick={puxar} disabled={isPending || !storeId} className="h-10">
            <Download className="mr-1 size-4" />
            {isPending ? "Puxando…" : "Puxar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
