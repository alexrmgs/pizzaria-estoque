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
import { Checkbox } from "@/components/ui/checkbox";
import { createFornecedor, updateFornecedor } from "./actions";

type Fornecedor = {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  note: string | null;
  productIds: string[];
};
type Product = { id: string; name: string };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function FornecedorDialog({
  fornecedor,
  products,
}: {
  fornecedor?: Fornecedor;
  products: Product[];
}) {
  const isEdit = !!fornecedor;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(fornecedor?.productIds ?? []));
  const [productSearch, setProductSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const filteredProducts = productSearch.trim()
    ? products.filter((p) => normalize(p.name).includes(normalize(productSearch)))
    : products;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        setSelected(new Set());
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
          setSelected(new Set(fornecedor?.productIds ?? []));
          setProductSearch("");
        }
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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

          <div className="flex flex-col gap-2">
            <Label>Produtos que esse fornecedor vende (opcional)</Label>
            {products.length === 0 ? (
              <p className="text-xs text-neutral-500">Nenhum ingrediente cadastrado ainda.</p>
            ) : (
              <>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="h-9"
                />
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                  {filteredProducts.length === 0 && (
                    <p className="text-xs text-neutral-500">Nenhum produto encontrado.</p>
                  )}
                  {filteredProducts.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        name="productIds"
                        value={p.id}
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
                {selected.size > 0 && (
                  <p className="text-xs text-neutral-500">{selected.size} selecionado(s)</p>
                )}
              </>
            )}
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
