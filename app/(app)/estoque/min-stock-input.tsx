"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setIngredientMinStock } from "./actions";

/** Estoque mínimo editável direto na tabela: salva no Enter ou ao sair do campo. */
export function MinStockInput({ id, name, value }: { id: string; name: string; value: number }) {
  const [texto, setTexto] = useState(String(value).replace(".", ","));
  const [salvo, setSalvo] = useState(value);
  const [pendente, start] = useTransition();

  function salvar() {
    const n = Number(texto.trim().replace(/\./g, "").replace(",", "."));
    if (texto.trim() === "" || !Number.isFinite(n) || n < 0) {
      setTexto(String(salvo).replace(".", ","));
      return toast.error("Estoque mínimo inválido");
    }
    if (n === salvo) return;
    start(async () => {
      const r = await setIngredientMinStock(id, n);
      if (r.error) {
        setTexto(String(salvo).replace(".", ","));
        return void toast.error(r.error);
      }
      setSalvo(n);
      toast.success(`Mínimo de ${name}: ${String(n).replace(".", ",")}`);
    });
  }

  return (
    <input
      aria-label={`Estoque mínimo de ${name}`}
      inputMode="decimal"
      value={texto}
      disabled={pendente}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTexto(String(salvo).replace(".", ","));
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-8 w-20 rounded-md border border-transparent bg-transparent px-2 text-sm tabular-nums outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        pendente && "opacity-50"
      )}
    />
  );
}
