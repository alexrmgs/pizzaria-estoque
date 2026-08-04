"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRevenue, updateRevenue } from "./actions";
import { REVENUE_CHANNELS, REVENUE_CHANNEL_LABELS } from "@/lib/financeiro";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type RevenueChannel = (typeof REVENUE_CHANNELS)[number];

type ExistingRevenue = {
  id: string;
  date: string; // YYYY-MM-DD
  storeId: string;
  channel: RevenueChannel;
  amount: number;
  orderCount: number;
  note: string | null;
};

export function RevenueDialog({
  stores,
  revenue,
  trigger,
}: {
  stores: { id: string; name: string }[];
  revenue?: ExistingRevenue;
  trigger?: React.ReactElement;
}) {
  const isEdit = !!revenue;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [storeId, setStoreId] = useState(revenue?.storeId ?? stores[0]?.id ?? "");
  const [channel, setChannel] = useState<RevenueChannel>(revenue?.channel ?? "LOJA_PROPRIA");
  const [amount, setAmount] = useState(revenue ? String(revenue.amount) : "");
  const [orderCount, setOrderCount] = useState(revenue ? String(revenue.orderCount) : "");
  const [note, setNote] = useState(revenue?.note ?? "");

  function handleChannelChange(next: RevenueChannel) {
    setChannel(next);
    // Cada canal é um lançamento independente — trocar o canal não deve
    // carregar o valor/pedidos/observação digitados pro canal anterior.
    setAmount("");
    setOrderCount("");
    setNote("");
  }

  const amountNum = Number(amount || 0);
  const ordersNum = Number(orderCount || 0);
  const ticketMedio = ordersNum > 0 ? amountNum / ordersNum : null;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEdit
        ? await updateRevenue(revenue.id, undefined, formData)
        : await createRevenue(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError(undefined);
          setStoreId(revenue?.storeId ?? stores[0]?.id ?? "");
          setChannel(revenue?.channel ?? "LOJA_PROPRIA");
          setAmount(revenue ? String(revenue.amount) : "");
          setOrderCount(revenue ? String(revenue.orderCount) : "");
          setNote(revenue?.note ?? "");
        }
      }}
    >
      <DialogTrigger
        render={trigger ?? (
          <Button size="sm">{isEdit ? "Editar" : "+ Lançar faturamento"}</Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Lançar faturamento"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" defaultValue={revenue?.date ?? todayISO()} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="storeId">Loja</Label>
              <input type="hidden" name="storeId" value={storeId} />
              <Select
                value={storeId || undefined}
                onValueChange={(v) => setStoreId(v ?? "")}
                items={stores.map((store) => ({ value: store.id, label: store.name }))}
              >
                <SelectTrigger id="storeId" className="w-full">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel">Canal de venda</Label>
            <input type="hidden" name="channel" value={channel} />
            <Select
              value={channel}
              onValueChange={(v) => v && handleChannelChange(v as RevenueChannel)}
              items={REVENUE_CHANNELS.map((c) => ({ value: c, label: REVENUE_CHANNEL_LABELS[c] }))}
            >
              <SelectTrigger id="channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {REVENUE_CHANNEL_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Faturamento do dia (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="orderCount">Quantidade de pedidos</Label>
              <Input
                id="orderCount"
                name="orderCount"
                type="number"
                step="1"
                min="0"
                value={orderCount}
                onChange={(e) => setOrderCount(e.target.value)}
              />
            </div>
          </div>
          {ticketMedio !== null && (
            <p className="text-xs text-muted-foreground">
              Ticket médio: <span className="font-medium text-foreground">{currency(ticketMedio)}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Já existe lançamento pra essa data, loja e canal? Não dá pra criar outro — edite o
              lançamento existente na tabela de lançamentos.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !storeId}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
