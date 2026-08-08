"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enfileirarEtiqueta } from "./actions";

export function EtiquetaForm() {
  const router = useRouter();
  const [pedido, setPedido] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [isPending, startTransition] = useTransition();
  const pedidoRef = useRef<HTMLInputElement>(null);

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
