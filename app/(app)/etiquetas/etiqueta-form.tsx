"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfileirarEtiqueta } from "./actions";

export function EtiquetaForm({ widthMm, heightMm }: { widthMm: number; heightMm: number }) {
  const router = useRouter();
  const [pedido, setPedido] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [isPending, startTransition] = useTransition();
  const pedidoRef = useRef<HTMLInputElement>(null);

  const totalVolumes = Math.max(1, Math.min(Number(volumes) || 1, 50));
  // Preview escala pela largura da etiqueta, pra o texto ficar parecido com o
  // que sai impresso.
  const pedidoFont = Math.max(14, Math.min(widthMm, heightMm * 1.6) * 0.28);

  function imprimir() {
    startTransition(async () => {
      const result = await enfileirarEtiqueta(pedido, Number(volumes));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Enviado pra impressora ✅");
      setPedido("");
      setVolumes("1");
      pedidoRef.current?.focus();
      router.refresh();
    });
  }

  function imprimirNavegador() {
    if (!pedido.trim()) {
      toast.error("Informe o número do pedido.");
      return;
    }
    const params = new URLSearchParams({ pedido: pedido.trim(), volumes });
    window.open(`/imprimir/etiquetas?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="pedido" className="text-xs">
            Número do pedido
          </Label>
          <Input
            id="pedido"
            ref={pedidoRef}
            inputMode="numeric"
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="Ex: 1"
            className="h-10 w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="volumes" className="text-xs">
            Volumes
          </Label>
          <Input
            id="volumes"
            type="number"
            min="1"
            max="50"
            value={volumes}
            onChange={(e) => setVolumes(e.target.value)}
            className="h-10 w-24"
          />
        </div>
        <Button onClick={imprimir} disabled={isPending} className="h-10">
          Imprimir etiquetas
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase text-neutral-500">
          Prévia da etiqueta ({widthMm}×{heightMm}mm)
        </p>
        <div
          style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
          className="flex max-w-full flex-col items-center justify-center gap-1 rounded-md border bg-white text-center"
        >
          <p className="font-black leading-none" style={{ fontSize: `${pedidoFont}pt` }}>
            PEDIDO {pedido.trim() || "—"}
          </p>
          <p className="font-bold leading-none" style={{ fontSize: `${pedidoFont * 0.6}pt` }}>
            1/{totalVolumes} VOLUME
          </p>
        </div>
        <p className="text-xs text-neutral-400">
          Imprime {totalVolumes} {totalVolumes === 1 ? "etiqueta" : "etiquetas"} (1/{totalVolumes},{" "}
          {totalVolumes > 1 ? `2/${totalVolumes}…` : ""}).
        </p>
      </div>

      <button
        type="button"
        onClick={imprimirNavegador}
        className="self-start text-xs text-neutral-400 underline hover:text-neutral-600"
      >
        Imprimir pelo navegador (provisório, até o PC estar configurado)
      </button>
    </div>
  );
}
