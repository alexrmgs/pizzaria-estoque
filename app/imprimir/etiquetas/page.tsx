import { requirePermission } from "@/lib/dal";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "./auto-print";

const PRINT_CSS = `
@media print {
  @page { margin: 4mm; }
  .etiqueta {
    break-after: page;
    height: 100vh;
    border: none !important;
    margin: 0 !important;
  }
  .etiqueta:last-child { break-after: auto; }
}
`;

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
          Pedido {pedido} — {volumes} {volumes === 1 ? "volume" : "volumes"}
        </p>
        <PrintButton />
      </div>

      <div className="flex flex-col items-center gap-4 p-4 print:gap-0 print:p-0">
        {labels.map((n) => (
          <div
            key={n}
            className="etiqueta flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded-lg border p-6 text-center"
          >
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
              FB Pizzaria
            </p>
            <p className="text-4xl font-black leading-none">PEDIDO {pedido}</p>
            <p className="text-2xl font-bold">
              {n}/{volumes} VOLUME
            </p>
          </div>
        ))}
      </div>

      <AutoPrint />
    </div>
  );
}
