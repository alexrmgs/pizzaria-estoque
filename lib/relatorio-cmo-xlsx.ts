import ExcelJS from "exceljs";
import type { RelatorioCmo } from "@/lib/relatorio-cmo";

const MOEDA = '"R$" #,##0.00';
const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

export async function buildCmoWorkbook(r: RelatorioCmo, empresa: string, periodo: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("CMO", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const header = [
    "Funcionário",
    "Cargo",
    "Loja",
    "Folha",
    "Salário",
    "Adic. noturno",
    "Horas extras",
    "Feriados",
    "Bônus",
    "Descontos (faltas/atrasos)",
    "Madrugada",
    "FGTS (8% est.)",
    "Rescisão",
    "CUSTO TOTAL",
    "Vales/adiant. no mês",
  ];
  ws.columns = [28, 16, 16, 11, 13, 13, 12, 12, 12, 15, 12, 13, 12, 15, 14].map((width) => ({ width }));

  const linhas: [string, Partial<ExcelJS.Font>][] = [
    [empresa || "Empresa", { bold: true, size: 14 }],
    ["Custo de Mão de Obra (CMO)", { bold: true, size: 12 }],
    [periodo, { size: 10 }],
  ];
  for (const [t, font] of linhas) {
    const row = ws.addRow([t]);
    ws.mergeCells(row.number, 1, row.number, 6);
    row.getCell(1).font = font;
  }
  ws.addRow([]);

  const resumo: [string, number | string, string?][] = [
    ["CMO total do mês", r.total, MOEDA],
    ["Faturamento do mês", r.faturamento, MOEDA],
    ["CMO / faturamento", r.percentual !== null ? r.percentual / 100 : "—", "0.0%"],
  ];
  for (const [k, v, fmt] of resumo) {
    const row = ws.addRow([k, "", v]);
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).font = { bold: true };
    row.getCell(3).font = { bold: true };
    if (fmt && typeof v === "number") row.getCell(3).numFmt = fmt;
  }
  ws.addRow([]);

  const head = ws.addRow(header);
  head.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = borda;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  head.height = 32;

  const valores = (f: RelatorioCmo["funcionarios"][number]) => [
    f.salario,
    f.adicionalNoturno,
    f.horasExtras,
    f.feriados,
    f.bonus,
    -f.descontos,
    f.madrugada,
    f.fgts,
    f.rescisao,
    f.total,
    f.adiantamentos,
  ];
  for (const f of r.funcionarios) {
    const row = ws.addRow([
      f.name,
      f.role ?? "",
      f.storeName ?? "",
      f.status === "FECHADA" ? "Fechada" : "Estimada",
      ...valores(f),
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = borda;
      if (col >= 5) cell.numFmt = MOEDA;
    });
    row.getCell(14).font = { bold: true };
    if (f.status === "ESTIMADA") row.getCell(4).font = { italic: true, color: { argb: "FFB45309" } };
  }

  const somas = r.funcionarios.reduce<number[]>(
    (acc, f) => valores(f).map((v, i) => (acc[i] ?? 0) + v),
    [],
  );
  const total = ws.addRow(["TOTAL", "", "", "", ...somas.map((v) => Math.round(v * 100) / 100)]);
  total.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
    cell.border = borda;
    if (col >= 5) cell.numFmt = MOEDA;
  });

  ws.addRow([]);
  const nota = ws.addRow([
    "Folha \"Estimada\" = pagamento do mês ainda não fechado; valor previsto pela mesma conta da tela de pagamento. FGTS estimado em 8% só pra quem tem carteira assinada. Descontos de faltas/atrasos reduzem o custo. Vales/adiantamentos são só informativos (já estão dentro do salário).",
  ]);
  ws.mergeCells(nota.number, 1, nota.number, header.length);
  nota.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  nota.getCell(1).alignment = { wrapText: true };
  nota.height = 30;

  return wb.xlsx.writeBuffer();
}
