"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirTspl } from "./ble-print";
import { buildPedidoTspl, buildVolumeTspl } from "./tspl";
import { marcarImpresso } from "./actions";

export function ReimprimirPedidoButton({
  id,
  pedido,
  cliente,
  volumes,
  volumeUnico,
  widthMm,
  heightMm,
}: {
  id: string;
  pedido: string;
  cliente?: string | null;
  volumes: number;
  volumeUnico?: number | null;
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
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
      await marcarImpresso(id);
      toast.success("Reimpresso ✅");
      router.refresh();
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
