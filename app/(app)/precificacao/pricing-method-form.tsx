"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updatePricingMethod } from "./actions";

export function PricingMethodForm({
  storeId,
  method,
  targetMarginPercent,
}: {
  storeId: string;
  method: "MARKUP" | "MARGEM";
  targetMarginPercent: number | null;
}) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<"MARKUP" | "MARGEM">(method);
  const [margem, setMargem] = useState(String(targetMarginPercent ?? 30));
  const [saving, setSaving] = useState(false);

  async function salvar(novoMetodo: "MARKUP" | "MARGEM", novaMargem?: string) {
    setSaving(true);
    const result = await updatePricingMethod({
      storeId,
      method: novoMetodo,
      targetMarginPercent: Number(novaMargem ?? margem) || null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Método de precificação atualizado ✅");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-neutral-500">Método de precificação</CardTitle>
        <p className="text-xs text-neutral-400">Escolha como calcular o preço sugerido.</p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="metodo"
            checked={metodo === "MARKUP"}
            onChange={() => {
              setMetodo("MARKUP");
              salvar("MARKUP");
            }}
          />
          Markup (custo fixo + variável embutidos no preço)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="metodo"
            checked={metodo === "MARGEM"}
            onChange={() => {
              setMetodo("MARGEM");
              salvar("MARGEM");
            }}
          />
          Margem desejada (ignora custo fixo e variável)
        </label>
        {metodo === "MARGEM" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="99"
              step="0.5"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
              onBlur={() => salvar("MARGEM")}
              className="h-9 w-24"
            />
            <span className="text-sm text-neutral-500">% de margem por item</span>
          </div>
        )}
        {saving && <span className="text-xs text-neutral-400">salvando...</span>}
      </CardContent>
    </Card>
  );
}
