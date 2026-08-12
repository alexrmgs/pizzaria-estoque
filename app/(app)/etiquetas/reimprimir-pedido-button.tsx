"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirTspl } from "./ble-print";
import { buildPedidoTspl, buildVolumeTspl } from "./tspl";

export function ReimprimirPedidoButton({
  pedido,
  cliente,
  volumes,
  volumeUnico,
  widthMm,
  heightMm,
}: {
  pedido: string;
  cliente?: string | null;
  volumes: number;
  volumeUnico?: number | null;
  widthMm: number;
  heightMm: number;
}) {
  const [printing, setPrinting] = useState(false);

  async function reimprimir() {
    setPrinting(true);
    try {
      const tspl = volumeUnico
        ? buildVolumeTspl({
            numero: pedido,
            cliente: cliente ?? "",
            volume: volumeUnico,
            volumes,
            widthMm,
            heightMm,
          })
        : buildPedidoTspl({
            numero: pedido,
            cliente: cliente ?? "",
            volumes,
            widthMm,
            heightMm,
          });
      await imprimirTspl(tspl);
      toast.success("Reimpresso ✅");
    } catch (e) {
      toast.error("Não imprimiu: " + (e instanceof Error ? e.message : "erro no Bluetooth"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={printing} onClick={reimprimir}>
      {printing ? "Imprimindo…" : "Reimprimir"}
    </Button>
  );
}
