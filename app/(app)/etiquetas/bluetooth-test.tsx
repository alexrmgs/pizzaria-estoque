"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Serviços BLE mais comuns em impressoras térmicas baratas. O navegador exige
// listar aqui os serviços que a gente pode acessar depois de conectar.
const PRINTER_SERVICE_UUIDS: (number | string)[] = [
  0x18f0,
  0xff00,
  0xffe0,
  0xffb0,
  0xfee0,
  0xff10,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

function buildTestTspl(): Uint8Array {
  const tspl = [
    "SIZE 100 mm,70 mm",
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "CLS",
    'TEXT 30,30,"3",0,3,3,"PEDIDO TESTE"',
    'TEXT 30,140,"3",0,2,2,"1/1 VOLUME"',
    "PRINT 1,1",
    "",
  ].join("\r\n");
  return new TextEncoder().encode(tspl);
}

export function BluetoothTest() {
  const [busy, setBusy] = useState(false);

  async function testar() {
    const bt = (navigator as any).bluetooth;
    if (!bt) {
      toast.error("Esse navegador não suporta Bluetooth. Use o Chrome no tablet Android.");
      return;
    }
    setBusy(true);
    try {
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();

      let writeChar: any = null;
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        toast.error(
          "Conectou, mas não achei como enviar dados. Provavelmente é Bluetooth comum — melhor irmos pelo PC.",
        );
        return;
      }

      const data = buildTestTspl();
      const chunk = 20;
      for (let i = 0; i < data.length; i += chunk) {
        const slice = data.slice(i, i + chunk);
        if (writeChar.properties.writeWithoutResponse) {
          await writeChar.writeValueWithoutResponse(slice);
        } else {
          await writeChar.writeValue(slice);
        }
        await new Promise((r) => setTimeout(r, 30));
      }

      toast.success("Enviei uma etiqueta de teste! Se saiu impressa, é BLE e dá pra imprimir direto ✅");
    } catch (e: any) {
      if (e?.name === "NotFoundError") {
        toast.error("Nenhuma impressora selecionada.");
      } else {
        toast.error("Não deu pra conectar. Pode ser Bluetooth comum — nesse caso vamos pelo PC.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" onClick={testar} disabled={busy}>
        {busy ? "Conectando…" : "🔵 Testar impressora Bluetooth"}
      </Button>
      <p className="text-xs text-neutral-400">
        Liga a impressora, toca aqui e escolhe ela. Se sair uma etiqueta de teste, funciona direto.
      </p>
    </div>
  );
}
