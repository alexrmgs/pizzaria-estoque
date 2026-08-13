// Gera o TSPL (linguagem da impressora Knup) das etiquetas. Posições e tamanho
// da fonte são calculados a partir do tamanho real da etiqueta (203dpi = 8
// dots/mm) e a fonte se ajusta pra caber na largura — nada sai cortado.

const DPMM = 8; // 203 dpi
const FONT = "3"; // fonte interna 16x24 (base)
const CHAR_W = 16; // largura base de 1 caractere na fonte "3"
const CHAR_H = 24; // altura base

// Remove acentos e aspas (impressora térmica não renderiza bem acento).
function limpar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/"/g, "")
    .toUpperCase();
}

// Maior escala (1..max) em que o texto cabe na largura disponível.
function escalaQueCabe(texto: string, larguraDisp: number, maxEscala: number): number {
  for (let s = maxEscala; s >= 1; s--) {
    if (texto.length * CHAR_W * s <= larguraDisp) return s;
  }
  return 1;
}

function corpo(
  widthMm: number,
  heightMm: number,
  pedido: string,
  cliente: string,
  linhaVolume: string,
): string[] {
  const wd = Math.round(widthMm * DPMM);
  const hd = Math.round(heightMm * DPMM);
  const margem = Math.round(2 * DPMM); // 2mm
  const disp = wd - 2 * margem;

  const textoPedido = `PEDIDO ${pedido}`;
  const escPedido = escalaQueCabe(textoPedido, disp, 4);
  const altPedido = CHAR_H * escPedido;

  const escVolume = escalaQueCabe(linhaVolume, disp, 2);
  const altVolume = CHAR_H * escVolume;

  const yPedido = margem;
  const yVolume = Math.max(yPedido + altPedido + 4, hd - altVolume - margem);
  const yCliente = Math.round((yPedido + altPedido + yVolume) / 2) - CHAR_H / 2;
  const temEspacoCliente = cliente && yVolume - (yPedido + altPedido) > CHAR_H + 8;

  const linhas = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
    `TEXT ${margem},${yPedido},"${FONT}",0,${escPedido},${escPedido},"${textoPedido}"`,
  ];
  if (temEspacoCliente) {
    linhas.push(`TEXT ${margem},${yCliente},"2",0,1,1,"${cliente}"`);
  }
  linhas.push(`TEXT ${margem},${yVolume},"${FONT}",0,${escVolume},${escVolume},"${linhaVolume}"`);
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

/** Etiqueta de produção (produto, temperatura, validade, responsável, empresa). */
export function buildProducaoTspl(input: {
  produto: string;
  temperatura: string;
  peso: string;
  fabricacao: string; // dd/mm/aaaa
  validade: string; // dd/mm/aaaa
  responsavel: string;
  empresaNome: string;
  empresaCnpj: string;
  empresaCidade: string;
  copias: number;
  widthMm: number;
  heightMm: number;
}): string {
  const wd = Math.round(input.widthMm * DPMM);
  const hd = Math.round(input.heightMm * DPMM);
  const margem = Math.round(2 * DPMM);
  const disp = wd - 2 * margem;

  const produto = limpar(input.produto) || "PRODUTO";
  const escProduto = escalaQueCabe(produto, disp, 3);

  const linhas: string[] = [
    `SIZE ${input.widthMm} mm,${input.heightMm} mm`,
    "GAP 2 mm,0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "CLS",
  ];
  let y = margem;
  linhas.push(`TEXT ${margem},${y},"${FONT}",0,${escProduto},${escProduto},"${produto}"`);
  y += CHAR_H * escProduto + 4;
  linhas.push(`BAR ${margem},${y},${disp},2`);
  y += 8;

  const linhasDet: string[] = [];
  const tempPeso = [limpar(input.temperatura), limpar(input.peso)].filter(Boolean).join("   ");
  if (tempPeso) linhasDet.push(tempPeso);
  linhasDet.push(`FABRIC: ${input.fabricacao}`);
  linhasDet.push(`VALIDADE: ${input.validade}`);
  if (input.responsavel.trim()) linhasDet.push(`RESP: ${limpar(input.responsavel)}`);
  for (const l of linhasDet) {
    linhas.push(`TEXT ${margem},${y},"1",0,1,1,"${l}"`);
    y += 20;
  }

  // Rodapé com a empresa, ancorado embaixo.
  const rod: string[] = [];
  if (input.empresaNome) rod.push(limpar(input.empresaNome));
  const cnpjCidade = [input.empresaCnpj ? `CNPJ ${input.empresaCnpj}` : "", limpar(input.empresaCidade)]
    .filter(Boolean)
    .join("  ");
  if (cnpjCidade) rod.push(cnpjCidade);
  let yRod = hd - margem - rod.length * 14;
  for (const l of rod) {
    if (yRod > y) {
      linhas.push(`TEXT ${margem},${yRod},"1",0,1,1,"${l}"`);
    }
    yRod += 14;
  }

  const copias = Math.max(1, Math.min(input.copias, 50));
  linhas.push(`PRINT ${copias},1`);
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
