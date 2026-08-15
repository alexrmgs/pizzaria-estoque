import { requireProducaoAccess } from "@/lib/dal";
import { QrScanner } from "./qr-scanner";

export default async function ScanLotePage() {
  await requireProducaoAccess();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Escanear QR — Dar Baixa</h1>
        <p className="text-sm text-neutral-500">
          Aponte a câmera pro QR code da etiqueta pra dar baixa no estoque.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}
