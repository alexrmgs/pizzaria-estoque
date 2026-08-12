"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { criarConta, editarConta } from "./actions";

type Store = { id: string; name: string };
type Payable = {
  id: string;
  description: string;
  category: string;
  amount: string;
  dueDate: string;
  storeId: string | null;
  note: string | null;
};

const CATEGORIAS = [
  "Aluguel",
  "Energia",
  "Água",
  "Internet/Telefone",
  "Fornecedor",
  "Salários",
  "Impostos",
  "Taxa de máquina",
  "Marketing",
  "Manutenção",
  "Outros",
];

export function PayableDialog({ stores, payable }: { stores: Store[]; payable?: Payable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [jaPaga, setJaPaga] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = payable
        ? await editarConta(payable.id, undefined, formData)
        : await criarConta(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        toast.success(payable ? "Conta atualizada ✅" : "Conta lançada ✅");
        router.refresh();
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
          setJaPaga(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant={payable ? "outline" : "default"} size="sm">
            {payable ? "Editar" : "+ Nova conta"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payable ? "Editar conta" : "Nova conta a pagar"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              defaultValue={payable?.description}
              placeholder="Ex: Aluguel da loja"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                name="category"
                list="categorias"
                defaultValue={payable?.category}
                placeholder="Ex: Aluguel"
                required
              />
              <datalist id="categorias">
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={payable?.amount}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={payable?.dueDate}
                required
              />
            </div>
            {stores.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="storeId">Loja (opcional)</Label>
                <select
                  id="storeId"
                  name="storeId"
                  defaultValue={payable?.storeId ?? ""}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Todas / geral</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Input id="note" name="note" defaultValue={payable?.note ?? ""} />
          </div>

          {!payable && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="jaPaga"
                checked={jaPaga}
                onChange={(e) => setJaPaga(e.target.checked)}
              />
              Já está paga
            </label>
          )}
          {!payable && jaPaga && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="paidDate">Data do pagamento</Label>
              <Input id="paidDate" name="paidDate" type="date" />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
