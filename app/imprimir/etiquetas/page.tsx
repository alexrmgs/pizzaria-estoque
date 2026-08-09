import { requireImpressaoAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "./auto-print";

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

export default async function ImprimirEtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireImpressaoAccess();
  const [params, settings] = await Promise.all([searchParams, getAppSettings()]);

  const larguraMm = settings.labelWidthMm;
  const alturaMm = settings.labelHeightMm;
  const tipo = str(params.tipo) === "producao" ? "producao" : "pedido";
  const baseFont = Math.max(12, Math.min(larguraMm, alturaMm * 1.6) * 0.24);

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

  let header = "";
  let labels: React.ReactNode[] = [];

  if (tipo === "producao") {
    const produto = str(params.produto);
    const producao = str(params.producao);
    const validade = str(params.validade);
    const temperatura = str(params.temperatura);
    const responsavel = str(params.responsavel);
    const peso = str(params.peso);
    const copiasRaw = parseInt(str(params.copias), 10);
    const copias = Number.isFinite(copiasRaw) ? Math.min(Math.max(copiasRaw, 1), 50) : 0;
    if (!produto || copias < 1) {
      return <div className="p-8 text-sm text-neutral-600">Informe o produto.</div>;
    }
    const titleFont = baseFont * 0.7;
    const lineFont = titleFont * 0.5;
    header = `${produto} — ${copias} ${copias === 1 ? "etiqueta" : "etiquetas"} · ${larguraMm}×${alturaMm}mm`;
    labels = Array.from({ length: copias }, (_, i) => (
      <div
        key={i}
        style={{ width: `${larguraMm}mm`, height: `${alturaMm}mm` }}
        className="etiqueta flex flex-col justify-center gap-0.5 rounded-lg border px-3"
      >
        <p className="text-center font-black leading-tight" style={{ fontSize: `${titleFont}pt` }}>
          {produto}
        </p>
        <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
          <b>Fab:</b> {formatBR(producao)} &nbsp; <b>Val:</b> {formatBR(validade)}
        </p>
        {temperatura && (
          <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
            <b>Temp:</b> {temperatura}
          </p>
        )}
        {peso && (
          <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
            <b>Peso:</b> {peso}
          </p>
        )}
        {responsavel && (
          <p className="leading-tight" style={{ fontSize: `${lineFont}pt` }}>
            <b>Resp:</b> {responsavel}
          </p>
        )}
      </div>
    ));
  } else {
    const pedido = str(params.pedido);
    const volumesRaw = parseInt(str(params.volumes), 10);
    const volumes = Number.isFinite(volumesRaw) ? Math.min(Math.max(volumesRaw, 1), 50) : 0;
    if (!pedido || volumes < 1) {
      return (
        <div className="p-8 text-sm text-neutral-600">
          Informe o número do pedido e a quantidade de volumes.
        </div>
      );
    }
    header = `Pedido ${pedido} — ${volumes} ${volumes === 1 ? "volume" : "volumes"} · ${larguraMm}×${alturaMm}mm`;
    labels = Array.from({ length: volumes }, (_, i) => i + 1).map((n) => (
      <div
        key={n}
        style={{ width: `${larguraMm}mm`, height: `${alturaMm}mm` }}
        className="etiqueta flex flex-col items-center justify-center gap-1 rounded-lg border text-center"
      >
        <p className="font-black leading-none" style={{ fontSize: `${baseFont * 1.15}pt` }}>
          PEDIDO {pedido}
        </p>
        <p className="font-bold leading-none" style={{ fontSize: `${baseFont * 0.7}pt` }}>
          {n}/{volumes} VOLUME
        </p>
      </div>
    ));
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="flex items-center justify-between p-4 print:hidden">
        <p className="text-sm text-neutral-500">{header}</p>
        <PrintButton />
      </div>

      <div className="flex flex-col items-center gap-4 p-4 print:gap-0 print:p-0">{labels}</div>

      <AutoPrint />
    </div>
  );
}
