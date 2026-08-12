"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

// Impressão Bluetooth (BLE) direto do navegador pra impressora térmica (Knup).
// Reaproveita o dispositivo já escolhido na sessão pra não pedir a impressora
// toda hora — depois de escolher 1 vez, os próximos "Imprimir" saem direto.

const PRINTER_SERVICE_UUIDS: (number | string)[] = [
  0x18f0, 0xff00, 0xffe0, 0xffb0, 0xfee0, 0xff10,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

let cachedDevice: any = null;
let cachedChar: any = null;

async function acharCaracteristica(device: any): Promise<any> {
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  return null;
}

async function getWriteChar(): Promise<any> {
  const bt = (navigator as any).bluetooth;
  if (!bt) throw new Error("Esse navegador não suporta Bluetooth. Use o Chrome no Android.");

  // Reusa a conexão da sessão.
  if (cachedChar && cachedDevice?.gatt?.connected) return cachedChar;

  let device = cachedDevice;
  // Tenta reconectar num dispositivo já autorizado antes de abrir o seletor.
  if (!device && bt.getDevices) {
    try {
      const conhecidos = await bt.getDevices();
      if (conhecidos?.length === 1) device = conhecidos[0];
    } catch {
      /* ignora */
    }
  }
  if (!device) {
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS,
    });
  }
  cachedDevice = device;
  const char = await acharCaracteristica(device);
  if (!char) {
    throw new Error(
      "Conectou mas não achei como enviar dados — pode ser Bluetooth comum (aí é pelo PC).",
    );
  }
  cachedChar = char;
  return char;
}

/** Envia bytes (TSPL) pra impressora em pacotes pequenos (limite do BLE). */
export async function imprimirBytes(data: Uint8Array): Promise<void> {
  const char = await getWriteChar();
  const chunk = 100;
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.slice(i, i + chunk);
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(slice);
    } else {
      await char.writeValue(slice);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

export async function imprimirTspl(tspl: string): Promise<void> {
  await imprimirBytes(new TextEncoder().encode(tspl));
}
