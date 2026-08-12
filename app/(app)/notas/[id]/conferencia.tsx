"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarRascunho, lancarNota, type NotaItemInput } from "../actions";

type Ingredient = { id: string; name: string; unit: string };

type ItemRow = {
  description: string;
  unit: string | null;
  quantity: string;
  unitValue: string;
  ingredientId: string;
};

type Props = {
  notaId: string;
  lancada: boolean;
  ingredients: Ingredient[];
  header: {
    numero: string;
    fornecedor: string;
    emissao: string;
    boleto: boolean;
    vencimento: string;
    total: string;
  };
  itens: ItemRow[];
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Conferencia({ notaId, lancada, ingredients, header, itens }: Props) {
  const router = useRouter();
  const [numero, setNumero] = useState(header.numero);
  const [fornecedor, setFornecedor] = useState(header.fornecedor);
  const [emissao, setEmissao] = useState(header.emissao);
  const [boleto, setBoleto] = useState(header.boleto);
  const [vencimento, setVencimento] = useState(header.vencimento);
  const [total, setTotal] = useState(header.total);
  const [rows, setRows] = useState<ItemRow[]>(itens);
  const [saving, setSaving] = useState(false);

  const ingUnit = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i.unit])),
    [ingredients],
  );

  function setRow(i: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [
      ...prev,
      { description: "", unit: null, quantity: "0", unitValue: "0", ingredientId: "" },
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toPayload(): { header: Parameters<typeof salvarRascunho>[1]; items: NotaItemInput[] } {
    const items: NotaItemInput[] = rows.map((r) => {
      const quantity = Number(r.quantity) || 0;
      const unitValue = Number(r.unitValue) || 0;
      return {
        description: r.description,
        unit: r.unit,
        quantity,
        unitValue,
        total: Math.round(quantity * unitValue * 100) / 100,
        ingredientId: r.ingredientId || null,
      };
    });
    return {
      header: {
        numero,
        fornecedor,
        emissao: emissao || null,
        boleto,
        vencimento: vencimento || null,
        total: Number(total) || 0,
      },
      items,
    };
  }

  async function salvar() {
    setSaving(true);
    const { header: h, items } = toPayload();
    const r = await salvarRascunho(notaId, h, items);
    setSaving(false);
    if (r.error) return toast.error(r.error);
    toast.success("Conferência salva ✅");
    router.refresh();
  }

  async function lancar() {
    if (!confirm("Lançar a entrada no estoque? Os itens casados vão dar entrada.")) return;
    setSaving(true);
    const { header: h, items } = toPayload();
    const r = await lancarNota(notaId, h, items);
    setSaving(false);
    if (r.error) return toast.error(r.error);
    toast.success("Nota lançada — estoque atualizado ✅");
    router.refresh();
  }

  const somaItens = rows.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitValue) || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Fornecedor</Label>
          <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} disabled={lancada} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Número da nota</Label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} disabled={lancada} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Emissão</Label>
          <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} disabled={lancada} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Total da nota (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            disabled={lancada}
          />
          <span className="text-[11px] text-neutral-400">Soma dos itens: {brl(somaItens)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Pagamento</Label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={boleto}
              onChange={(e) => setBoleto(e.target.checked)}
              disabled={lancada}
            />
            Boleto (gera conta a pagar)
          </label>
        </div>
        {boleto && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Vencimento do boleto</Label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              disabled={lancada}
            />
          </div>
        )}
      </div>

      {/* Itens */}
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-semibold uppercase text-neutral-500">
            Itens da nota — casar com o produto e conferir
          </span>
          {!lancada && (
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="size-3.5" /> item
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="p-2">Descrição na nota</th>
                <th className="p-2">Produto no estoque</th>
                <th className="p-2 w-24">Qtd</th>
                <th className="p-2 w-28">Custo unit.</th>
                <th className="p-2 w-24 text-right">Total</th>
                {!lancada && <th className="p-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const un = r.ingredientId ? ingUnit.get(r.ingredientId) : null;
                const linhaTotal = (Number(r.quantity) || 0) * (Number(r.unitValue) || 0);
                return (
                  <tr key={i} className="border-b align-top">
                    <td className="p-2">
                      <Input
                        value={r.description}
                        onChange={(e) => setRow(i, { description: e.target.value })}
                        disabled={lancada}
                        className="h-8"
                      />
                      {r.unit && <span className="text-[11px] text-neutral-400">un. nota: {r.unit}</span>}
                    </td>
                    <td className="p-2">
                      <select
                        value={r.ingredientId}
                        onChange={(e) => setRow(i, { ingredientId: e.target.value })}
                        disabled={lancada}
                        className={
                          "h-8 w-full rounded-md border px-2 text-sm " +
                          (r.ingredientId ? "border-input" : "border-amber-400 bg-amber-50")
                        }
                      >
                        <option value="">— não dar entrada —</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                      {un && <span className="text-[11px] text-neutral-400">estoque em: {un}</span>}
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.001"
                        value={r.quantity}
                        onChange={(e) => setRow(i, { quantity: e.target.value })}
                        disabled={lancada}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        value={r.unitValue}
                        onChange={(e) => setRow(i, { unitValue: e.target.value })}
                        disabled={lancada}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2 text-right font-medium">{brl(linhaTotal)}</td>
                    {!lancada && (
                      <td className="p-2">
                        <button type="button" onClick={() => removeRow(i)} className="text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-neutral-500">
                    Sem itens. {lancada ? "" : "Clique em + item."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!lancada ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={salvar} disabled={saving} variant="outline">
            Salvar conferência
          </Button>
          <Button onClick={lancar} disabled={saving}>
            Lançar entrada no estoque
          </Button>
          <p className="text-xs text-neutral-400">
            Só entram no estoque os itens com um produto selecionado. Ajuste a quantidade pra unidade
            do estoque, se precisar.
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium text-emerald-600">
          Nota lançada — as entradas já estão no estoque{boleto ? " e a conta foi pra Contas a Pagar" : ""}.
        </p>
      )}
    </div>
  );
}
