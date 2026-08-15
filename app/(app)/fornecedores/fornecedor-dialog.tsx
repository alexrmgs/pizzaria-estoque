"use client";

import { useRef, useState, useTransition } from "react";
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
import { createFornecedor, updateFornecedor } from "./actions";

type Fornecedor = { id: string; name: string; cnpj: string | null; phone: string | null; note: string | null };

export function FornecedorDialog({ fornecedor }: { fornecedor?: Fornecedor }) {
  const isEdit = !!fornecedor;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEdit
        ? await updateFornecedor(fornecedor.id, undefined, formData)
        : await createFornecedor(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="sm">
              Editar
            </Button>
          ) : (
            <Button size="sm">+ Novo fornecedor</Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={fornecedor?.name} placeholder="Ex: Laticínios Bom Leite" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input id="cnpj" name="cnpj" defaultValue={fornecedor?.cnpj ?? ""} placeholder="00.000.000/0000-00" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input id="phone" name="phone" defaultValue={fornecedor?.phone ?? ""} placeholder="(85) 90000-0000" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea id="note" name="note" defaultValue={fornecedor?.note ?? ""} placeholder="Ex: entrega toda terça" />
          </div>
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
