// Gera o TSPL (linguagem da impressora Knup) das etiquetas, no mesmo formato
// da prévia da tela.

// Remove acentos e aspas (impressora térmica não renderiza bem acento).
function limpar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/"/g, "")
    .toUpperCase();
}

function cabecalho(widthMm: number, heightMm: number): string[] {
  return [`SIZE ${widthMm} mm,${heightMm} mm`, "GAP 2 mm,0 mm", "DIRECTION 1"];
}

/** Etiquetas de um pedido: uma por volume (ex: 1/3, 2/3, 3/3). */
export function buildPedidoTspl(input: {
  numero: number | string;
  cliente?: string;
  volumes: number;
  widthMm: number;
  heightMm: number;
}): string {
  const linhas: string[] = [];
  const pedido = limpar(String(input.numero));
  const cliente = limpar(input.cliente ?? "");
  const total = Math.max(1, Math.min(input.volumes, 50));
  for (let n = 1; n <= total; n++) {
    linhas.push(...cabecalho(input.widthMm, input.heightMm));
    linhas.push("CLS");
    linhas.push(`TEXT 30,30,"3",0,3,3,"PEDIDO ${pedido}"`);
    if (cliente) linhas.push(`TEXT 30,150,"2",0,1,1,"${cliente}"`);
    linhas.push(`TEXT 30,210,"3",0,2,2,"${n}/${total} VOLUME"`);
    linhas.push("PRINT 1,1");
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
  const linhas: string[] = [];
  linhas.push(...cabecalho(input.widthMm, input.heightMm));
  linhas.push("CLS");
  linhas.push(`TEXT 30,30,"3",0,3,3,"PEDIDO ${pedido}"`);
  if (cliente) linhas.push(`TEXT 30,150,"2",0,1,1,"${cliente}"`);
  linhas.push(`TEXT 30,210,"3",0,2,2,"${input.volume}/${input.volumes} VOLUME"`);
  linhas.push("PRINT 1,1");
  linhas.push("");
  return linhas.join("\r\n");
}
