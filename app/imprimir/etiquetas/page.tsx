import { requirePermission } from "@/lib/dal";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "./auto-print";

function clampNumber(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

export default async function ImprimirEtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canManageEstoque");
  const params = await searchParams;

  const pedido = typeof params.pedido === "string" ? params.pedido.trim() : "";
  const volumesRaw = typeof params.volumes === "string" ? parseInt(params.volumes, 10) : NaN;
  const volumes = Number.isFinite(volumesRaw) ? Math.min(Math.max(volumesRaw, 1), 50) : 0;
  const larguraMm = clampNumber(params.largura, 100, 20, 200);
  const alturaMm = clampNumber(params.altura, 70, 20, 200);

  // Escala o texto pelo tamanho da etiqueta pra ele preencher bem tanto uma
  // etiqueta pequena quanto uma grande.
  const pedidoFont = Math.max(14, Math.min(larguraMm, alturaMm * 1.6) * 0.28);
  const volumeFont = pedidoFont * 0.6;

  const PRINT_CSS = `
@media print {
  @page { size: ${larguraMm}mm ${alturaMm}mm; margin: 0; }
  html, body { margin: 0; }
  .etiqueta {
    break-after: page;
    width: ${larguraMm}mm;
    height: ${alturaMm}mm;
    border: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }
  .etiqueta:last-child { break-after: auto; }
}
`;

  if (!pedido || volumes < 1) {
    return (
      <div className="p-8 text-sm text-neutral-600">
        Informe o número do pedido e a quantidade de volumes.
      </div>
    );
  }

  const labels = Array.from({ length: volumes }, (_, i) => i + 1);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="flex items-center justify-between p-4 print:hidden">
        <p className="text-sm text-neutral-500">
          Pedido {pedido} — {volumes} {volumes === 1 ? "volume" : "volumes"} · {larguraMm}×{alturaMm}mm
        </p>
        <PrintButton />
      </div>

      <div className="flex flex-col items-center gap-4 p-4 print:gap-0 print:p-0">
        {labels.map((n) => (
          <div
            key={n}
            style={{ width: `${larguraMm}mm`, height: `${alturaMm}mm` }}
            className="etiqueta flex flex-col items-center justify-center gap-1 rounded-lg border text-center"
          >
            <p className="font-semibold tracking-widest text-neutral-500 uppercase" style={{ fontSize: `${volumeFont * 0.5}pt` }}>
              FB Pizzaria
            </p>
            <p className="font-black leading-none" style={{ fontSize: `${pedidoFont}pt` }}>
              PEDIDO {pedido}
            </p>
            <p className="font-bold leading-none" style={{ fontSize: `${volumeFont}pt` }}>
              {n}/{volumes} VOLUME
            </p>
          </div>
        ))}
      </div>

      <AutoPrint />
    </div>
  );
}
