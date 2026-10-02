import ExcelJS from "exceljs";
import { REVENUE_CHANNEL_LABELS } from "@/lib/financeiro";

// Relatório de canais de venda no mesmo formato da planilha que a gente já
// usava: uma linha por loja, TOTAL (qtd + valor) e depois qtd + valor de
// cada canal, com uma linha de TOTAL geral embaixo.

export type LinhaCanal = { storeName: string; channel: string; amount: number; orderCount: number };

const MOEDA = '"R$" #,##0.00';
const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

export function channelLabel(channel: string) {
  return (REVENUE_CHANNEL_LABELS[channel] ?? channel).toUpperCase();
}

export async function buildRelatorioCanais(linhas: LinhaCanal[], periodo: string) {
  // Agrupa pelo nome exibido — o mesmo canal pode vir escrito diferente
  // (ex: "IFOOD" lançado à mão e "iFood" vindo da SaiPos).
  const porLoja = new Map<string, Map<string, { qtd: number; valor: number }>>();
  const totalCanal = new Map<string, number>();
  for (const l of linhas) {
    const canal = channelLabel(l.channel);
    const loja = porLoja.get(l.storeName) ?? new Map();
    const atual = loja.get(canal) ?? { qtd: 0, valor: 0 };
    atual.qtd += l.orderCount;
    atual.valor += l.amount;
    loja.set(canal, atual);
    porLoja.set(l.storeName, loja);
    totalCanal.set(canal, (totalCanal.get(canal) ?? 0) + l.amount);
  }
  // Canais do maior pro menor faturamento.
  const canais = [...totalCanal.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const lojas = [...porLoja.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Relatório canais de venda", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const header = ["LOJA", "TOTAL QTD", "TOTAL", ...canais.flatMap((c) => [`${c} QTD`, c])];
  ws.columns = header.map((_, i) => ({ width: i === 0 ? 34 : i % 2 === 1 ? 11 : 16 }));

  const titulo = ws.addRow([`RELATÓRIO CANAIS DE VENDA — ${periodo}`]);
  ws.mergeCells(titulo.number, 1, titulo.number, Math.min(header.length, 9));
  titulo.getCell(1).font = { bold: true, size: 13 };
  ws.addRow([]);

  const head = ws.addRow(header);
  head.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = borda;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  head.height = 32;

  const somaQtd = new Array(canais.length).fill(0);
  const somaValor = new Array(canais.length).fill(0);
  let somaTotQtd = 0;
  let somaTotValor = 0;

  const formatar = (row: ExcelJS.Row, bold = false) => {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = borda;
      if (col > 1 && col % 2 === 1) cell.numFmt = MOEDA;
      if (col > 1 && col % 2 === 0) cell.numFmt = "#,##0";
      if (bold) {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
    });
  };

  for (const loja of lojas) {
    const dados = porLoja.get(loja)!;
    let totQtd = 0;
    let totValor = 0;
    const cols: (number | string)[] = [];
    canais.forEach((c, i) => {
      const d = dados.get(c);
      if (d) {
        totQtd += d.qtd;
        totValor += d.valor;
        somaQtd[i] += d.qtd;
        somaValor[i] += d.valor;
        cols.push(d.qtd, Math.round(d.valor * 100) / 100);
      } else {
        cols.push("", "");
      }
    });
    somaTotQtd += totQtd;
    somaTotValor += totValor;
    formatar(ws.addRow([loja, totQtd, Math.round(totValor * 100) / 100, ...cols]));
  }

  formatar(
    ws.addRow([
      "TOTAL",
      somaTotQtd,
      Math.round(somaTotValor * 100) / 100,
      ...canais.flatMap((_, i) => [somaQtd[i], Math.round(somaValor[i] * 100) / 100]),
    ]),
    true,
  );

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: head.number }];
  return wb.xlsx.writeBuffer();
}
