"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInBrazil } from "@/lib/payroll";

function isoDaysAgo(days: number) {
  const d = todayInBrazil();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Baixa o "Relatório canais de venda" (.xlsx): por loja, total + cada canal. */
export function RelatorioCanaisDialog() {
  const [open, setOpen] = useState(false);
  // Padrão: últimos 90 dias até ontem (hoje ainda está em andamento).
  const [from, setFrom] = useState(() => isoDaysAgo(90));
  const [to, setTo] = useState(() => isoDaysAgo(1));

  const atalho = (dias: number) => {
    setFrom(isoDaysAgo(dias));
    setTo(isoDaysAgo(1));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Relatório de canais (Excel)</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relatório canais de venda</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90].map((d) => (
              <Button key={d} type="button" size="sm" variant="outline" onClick={() => atalho(d)}>
                Últimos {d} dias
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rc-from">De</Label>
              <Input id="rc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rc-to">Até</Label>
              <Input id="rc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Uma linha por loja com o total e a quantidade/valor de cada canal (iFood, 99Food, loja
            própria…), mais o total geral.
          </p>
        </div>
        <DialogFooter>
          <a
            href={`/financeiro/relatorio-canais?from=${from}&to=${to}`}
            onClick={() => setOpen(false)}
          >
            <Button type="button" disabled={!from || !to || from > to}>
              Baixar Excel
            </Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
