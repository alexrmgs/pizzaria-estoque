// Gera o TSPL (linguagem da impressora Knup) das etiquetas. As posições são
// calculadas a partir do tamanho real da etiqueta (em dots, 203dpi = 8 dots/mm)
// pra nada sair cortado, independente do tamanho configurado.

const DPMM = 8; // 203 dpi

// Remove acentos e aspas (impressora térmica não renderiza bem acento).
function limpar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/"/g, "")
    .toUpperCase();
}

function corpo(
  widthMm: number,
  heightMm: number,
  pedido: string,
  cliente: string,
  linhaVolume: string,
): string[] {
  const hd = Math.round(heightMm * DPMM);
  const margem = Math.round(3 * DPMM); // 3mm

  // A linha do volume fica ancorada embaixo, com margem — nunca corta.
  const alturaVolume = 24 * 2; // fonte "3" x2
  const yVolume = Math.max(margem, hd - alturaVolume - margem);
  const yPedido = margem;
  const yCliente = Math.round(hd * 0.45);

  const linhas = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    `TEXT ${margem},${yPedido},"3",0,3,3,"PEDIDO ${pedido}"`,
  ];
  if (cliente) linhas.push(`TEXT ${margem},${yCliente},"2",0,1,1,"${cliente}"`);
  linhas.push(`TEXT ${margem},${yVolume},"3",0,2,2,"${linhaVolume}"`);
  linhas.push("PRINT 1,1");
  return linhas;
}

/** Etiquetas de um pedido: uma por volume (ex: 1/3, 2/3, 3/3). */
export function buildPedidoTspl(input: {
  numero: number | string;
  cliente?: string;
  volumes: number;
  widthMm: number;
  heightMm: number;
}): string {
  const pedido = limpar(String(input.numero));
  const cliente = limpar(input.cliente ?? "");
  const total = Math.max(1, Math.min(input.volumes, 50));
  const linhas: string[] = [];
  for (let n = 1; n <= total; n++) {
    linhas.push(...corpo(input.widthMm, input.heightMm, pedido, cliente, `${n}/${total} VOLUME`));
  }
  linhas.push("");
  return linhas.join("\r\n");
}

/** Reimpressão de um volume específico (ex: só o 2/3). */
export function buildVolumeTspl(input: {
  numero: number | string;
  cliente?: string;
  volume: number;
  volumes: number;
  widthMm: number;
  heightMm: number;
}): string {
  const pedido = limpar(String(input.numero));
  const cliente = limpar(input.cliente ?? "");
  const linhas = corpo(
    input.widthMm,
    input.heightMm,
    pedido,
    cliente,
    `${input.volume}/${input.volumes} VOLUME`,
  );
  linhas.push("");
  return linhas.join("\r\n");
}
