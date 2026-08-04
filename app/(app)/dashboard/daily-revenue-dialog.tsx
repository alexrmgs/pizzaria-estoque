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
import { cn } from "@/lib/utils";
import { createDailyRevenueSplit } from "./actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyRevenueDialog({ stores }: { stores: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [totalAmount, setTotalAmount] = useState("");
  const [ifoodAmount, setIfoodAmount] = useState("");
  const [ifoodOrders, setIfoodOrders] = useState("");
  const [food99Amount, setFood99Amount] = useState("");
  const [food99Orders, setFood99Orders] = useState("");
  const [lojaOrders, setLojaOrders] = useState("");

  const totalNum = Number(totalAmount || 0);
  const ifoodNum = Number(ifoodAmount || 0);
  const food99Num = Number(food99Amount || 0);
  const lojaAmount = totalNum - ifoodNum - food99Num;

  function reset() {
    setError(undefined);
    setStoreId(stores[0]?.id ?? "");
    setTotalAmount("");
    setIfoodAmount("");
    setIfoodOrders("");
    setFood99Amount("");
    setFood99Orders("");
    setLojaOrders("");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createDailyRevenueSplit(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        reset();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm">+ Lançar faturamento do dia</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançar faturamento do dia</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" defaultValue={todayISO()} required />
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
            <Label htmlFor="totalAmount">Faturamento TOTAL do dia (R$)</Label>
            <Input
              id="totalAmount"
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">🛵 iFood</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ifoodAmount" className="text-xs text-neutral-500">
                  Faturamento (R$)
                </Label>
                <Input
                  id="ifoodAmount"
                  name="ifoodAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={ifoodAmount}
                  onChange={(e) => setIfoodAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ifoodOrders" className="text-xs text-neutral-500">
                  Pedidos
                </Label>
                <Input
                  id="ifoodOrders"
                  name="ifoodOrders"
                  type="number"
                  step="1"
                  min="0"
                  value={ifoodOrders}
                  onChange={(e) => setIfoodOrders(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">🛵 99Food</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="food99Amount" className="text-xs text-neutral-500">
                  Faturamento (R$)
                </Label>
                <Input
                  id="food99Amount"
                  name="food99Amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={food99Amount}
                  onChange={(e) => setFood99Amount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="food99Orders" className="text-xs text-neutral-500">
                  Pedidos
                </Label>
                <Input
                  id="food99Orders"
                  name="food99Orders"
                  type="number"
                  step="1"
                  min="0"
                  value={food99Orders}
                  onChange={(e) => setFood99Orders(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">🏠 Loja própria (calculado)</p>
            <div className="grid grid-cols-2 items-end gap-3">
              <div>
                <p className="text-xs text-neutral-500">Faturamento (total − iFood − 99Food)</p>
                <p className={cn("text-lg font-semibold", lojaAmount < 0 && "text-destructive")}>
                  {currency(lojaAmount)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lojaOrders" className="text-xs text-neutral-500">
                  Pedidos (opcional)
                </Label>
                <Input
                  id="lojaOrders"
                  name="lojaOrders"
                  type="number"
                  step="1"
                  min="0"
                  value={lojaOrders}
                  onChange={(e) => setLojaOrders(e.target.value)}
                />
              </div>
            </div>
            {lojaAmount < 0 && (
              <p className="mt-2 text-xs text-destructive">
                iFood + 99Food é maior que o faturamento total — confira os valores.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>

          <p className="text-xs text-muted-foreground">
            Já existe lançamento pra essa data e loja? Os valores de cada canal são substituídos
            pelos novos ao salvar de novo.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || !storeId || lojaAmount < 0}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
