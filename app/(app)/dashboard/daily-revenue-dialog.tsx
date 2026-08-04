"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { createDailyRevenueSplit, getDailyRevenueSplit } from "./actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyRevenueDialog({
  stores,
  trigger,
  initialDate,
  initialStoreId,
}: {
  stores: { id: string; name: string }[];
  trigger?: React.ReactElement;
  initialDate?: string;
  initialStoreId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const [storeId, setStoreId] = useState(initialStoreId ?? stores[0]?.id ?? "");
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [totalAmount, setTotalAmount] = useState("");
  const [ifoodAmount, setIfoodAmount] = useState("");
  const [ifoodOrders, setIfoodOrders] = useState("");
  const [food99Amount, setFood99Amount] = useState("");
  const [food99Orders, setFood99Orders] = useState("");
  const [lojaOrders, setLojaOrders] = useState("");
  const [note, setNote] = useState("");

  const totalNum = Number(totalAmount || 0);
  const ifoodNum = Number(ifoodAmount || 0);
  const food99Num = Number(food99Amount || 0);
  const lojaAmount = totalNum - ifoodNum - food99Num;

  function reset() {
    setError(undefined);
    setLoadedExisting(false);
    setStoreId(initialStoreId ?? stores[0]?.id ?? "");
    setDate(initialDate ?? todayISO());
    setTotalAmount("");
    setIfoodAmount("");
    setIfoodOrders("");
    setFood99Amount("");
    setFood99Orders("");
    setLojaOrders("");
    setNote("");
  }

  // Busca o que já foi lançado nesse dia/loja pra não sobrescrever com zero
  // ao reabrir o diálogo pra corrigir só um dos canais.
  useEffect(() => {
    if (!open || !storeId || !date) return;
    let cancelled = false;
    async function loadExisting() {
      setIsLoadingExisting(true);
      const data = await getDailyRevenueSplit(storeId, date);
      if (cancelled) return;
      setIsLoadingExisting(false);
      if (data) {
        setTotalAmount(String(data.totalAmount));
        setIfoodAmount(String(data.ifoodAmount));
        setIfoodOrders(String(data.ifoodOrders));
        setFood99Amount(String(data.food99Amount));
        setFood99Orders(String(data.food99Orders));
        setLojaOrders(String(data.lojaOrders));
        setNote(data.note);
        setLoadedExisting(true);
      } else {
        setTotalAmount("");
        setIfoodAmount("");
        setIfoodOrders("");
        setFood99Amount("");
        setFood99Orders("");
        setLojaOrders("");
        setNote("");
        setLoadedExisting(false);
      }
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [open, storeId, date]);

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
      <DialogTrigger render={trigger ?? <Button size="sm">+ Lançar faturamento do dia</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialDate ? "Editar faturamento do dia" : "Lançar faturamento do dia"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
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

          {isLoadingExisting && (
            <p className="text-xs text-muted-foreground">Verificando lançamentos existentes...</p>
          )}
          {!isLoadingExisting && loadedExisting && (
            <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              Já existia lançamento pra essa data/loja — carreguei os valores salvos, ajuste o que
              precisar.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Faturamento (R$)</TableHead>
                  <TableHead>Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Faturamento TOTAL</TableCell>
                  <TableCell>
                    <Label htmlFor="totalAmount" className="sr-only">
                      Faturamento total do dia
                    </Label>
                    <Input
                      id="totalAmount"
                      name="totalAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-28"
                      required
                    />
                  </TableCell>
                  <TableCell className="text-neutral-400">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">🛵 iFood</TableCell>
                  <TableCell>
                    <Label htmlFor="ifoodAmount" className="sr-only">
                      Faturamento iFood
                    </Label>
                    <Input
                      id="ifoodAmount"
                      name="ifoodAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={ifoodAmount}
                      onChange={(e) => setIfoodAmount(e.target.value)}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Label htmlFor="ifoodOrders" className="sr-only">
                      Pedidos iFood
                    </Label>
                    <Input
                      id="ifoodOrders"
                      name="ifoodOrders"
                      type="number"
                      step="1"
                      min="0"
                      value={ifoodOrders}
                      onChange={(e) => setIfoodOrders(e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">🛵 99Food</TableCell>
                  <TableCell>
                    <Label htmlFor="food99Amount" className="sr-only">
                      Faturamento 99Food
                    </Label>
                    <Input
                      id="food99Amount"
                      name="food99Amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={food99Amount}
                      onChange={(e) => setFood99Amount(e.target.value)}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Label htmlFor="food99Orders" className="sr-only">
                      Pedidos 99Food
                    </Label>
                    <Input
                      id="food99Orders"
                      name="food99Orders"
                      type="number"
                      step="1"
                      min="0"
                      value={food99Orders}
                      onChange={(e) => setFood99Orders(e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">🏠 Loja própria</TableCell>
                  <TableCell className={cn("font-semibold", lojaAmount < 0 && "text-destructive")}>
                    {currency(lojaAmount)}
                  </TableCell>
                  <TableCell>
                    <Label htmlFor="lojaOrders" className="sr-only">
                      Pedidos loja própria
                    </Label>
                    <Input
                      id="lojaOrders"
                      name="lojaOrders"
                      type="number"
                      step="1"
                      min="0"
                      value={lojaOrders}
                      onChange={(e) => setLojaOrders(e.target.value)}
                      className="w-20"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-neutral-500">
            Loja própria é calculada sozinha: total − iFood − 99Food.
          </p>
          {lojaAmount < 0 && (
            <p className="text-xs text-destructive">
              iFood + 99Food é maior que o faturamento total — confira os valores.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea id="note" name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending || isLoadingExisting || !storeId || lojaAmount < 0}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
