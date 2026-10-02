import ExcelJS from "exceljs";
import {
  formatDiaBR,
  SITUACAO_LABEL,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type FuncionarioPonto,
} from "@/lib/relatorio-ponto";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Horas vão pro Excel como fração de dia com formato [h]:mm — assim a
// contabilidade pode somar/conferir as colunas direto na planilha.
const HORA_FMT = "[h]:mm";
const toExcelHoras = (h: number) => Math.round(h * 60) / 60 / 24;

const COR = {
  titulo: "FF1F2937",
  cabecalho: "FFE5E7EB",
  folga: "FFF3F4F6",
  falta: "FFFEE2E2",
  atestado: "FFDBEAFE",
  feriado: "FFFEF3C7",
  semRegistro: "FFFFEDD5",
  total: "FFF9FAFB",
};

const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export type Empresa = { nome: string; cnpj: string; endereco: string; cidade: string };

/** Bloco de cabeçalho (empresa, CNPJ, período) no topo de cada aba. */
function cabecalhoEmpresa(ws: ExcelJS.Worksheet, empresa: Empresa, titulo: string, periodo: string, cols: number) {
  const linhas: [string, Partial<ExcelJS.Font>][] = [
    [empresa.nome || "Empresa", { bold: true, size: 14 }],
    [[empresa.cnpj && `CNPJ: ${empresa.cnpj}`, empresa.endereco, empresa.cidade].filter(Boolean).join(" · "), { size: 10, color: { argb: "FF6B7280" } }],
    [titulo, { bold: true, size: 12 }],
    [periodo, { size: 10 }],
  ];
  for (const [texto, font] of linhas) {
    const row = ws.addRow([texto]);
    ws.mergeCells(row.number, 1, row.number, cols);
    row.getCell(1).font = font;
  }
  ws.addRow([]);
}

function estiloCabecalhoTabela(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = fill(COR.cabecalho);
    cell.border = borda;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 30;
}

function abaResumo(wb: ExcelJS.Workbook, relatorio: FuncionarioPonto[], empresa: Empresa, periodo: string) {
  const ws = wb.addWorksheet("Resumo", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const header = [
    "Funcionário",
    "Cargo",
    "Loja",
    "Admissão",
    "Dias trabalhados",
    "Horas trabalhadas",
    "Horas diurnas",
    "Horas noturnas (22h–5h)",
    "Feriados trabalhados",
    "Datas dos feriados",
    "Faltas",
    "Datas das faltas",
    "Atestados",
    "Datas dos atestados",
    "Folgas",
    "Dias sem registro",
  ];
  ws.columns = [28, 16, 16, 12, 11, 12, 12, 13, 11, 22, 9, 22, 10, 22, 9, 22].map((width) => ({ width }));
  cabecalhoEmpresa(ws, empresa, "Relatório de Ponto — Resumo", periodo, header.length);

  estiloCabecalhoTabela(ws.addRow(header));
  const primeira = ws.rowCount + 1;
  for (const f of relatorio) {
    const row = ws.addRow([
      f.name,
      f.role ?? "",
      f.storeName ?? "",
      f.hireDate ? formatDiaBR(f.hireDate) : "",
      f.diasTrabalhados,
      toExcelHoras(f.totalHoras),
      toExcelHoras(f.totalHoras - f.totalNoturnas),
      toExcelHoras(f.totalNoturnas),
      f.feriadosTrabalhados.length,
      f.feriadosTrabalhados.map(formatDiaBR).join(", "),
      f.faltas.length,
      f.faltas.map(formatDiaBR).join(", "),
      f.atestados.length,
      f.atestados.map(formatDiaBR).join(", "),
      f.folgas,
      f.semRegistro.map(formatDiaBR).join(", "),
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borda;
      cell.alignment = { vertical: "top", wrapText: true };
    });
    [6, 7, 8].forEach((c) => (row.getCell(c).numFmt = HORA_FMT));
    if (f.faltas.length) row.getCell(11).font = { bold: true, color: { argb: "FFB91C1C" } };
  }
  const ultima = ws.rowCount;

  if (relatorio.length > 1) {
    // Fórmula + resultado já calculado: quem abrir num visualizador que não
    // recalcula (prévia do email) também vê o total.
    const sum = (col: string, result: number) => ({
      formula: `SUM(${col}${primeira}:${col}${ultima})`,
      result,
    });
    const tot = (fn: (f: FuncionarioPonto) => number) => relatorio.reduce((a, f) => a + fn(f), 0);
    const total = ws.addRow([
      "TOTAL", "", "", "",
      sum("E", tot((f) => f.diasTrabalhados)),
      sum("F", tot((f) => toExcelHoras(f.totalHoras))),
      sum("G", tot((f) => toExcelHoras(f.totalHoras - f.totalNoturnas))),
      sum("H", tot((f) => toExcelHoras(f.totalNoturnas))),
      sum("I", tot((f) => f.feriadosTrabalhados.length)),
      "",
      sum("K", tot((f) => f.faltas.length)),
      "",
      sum("M", tot((f) => f.atestados.length)),
      "",
      sum("O", tot((f) => f.folgas)),
      "",
    ]);
    total.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.fill = fill(COR.total);
      cell.border = borda;
    });
    [6, 7, 8].forEach((c) => (total.getCell(c).numFmt = HORA_FMT));
  }

  ws.addRow([]);
  const legenda = ws.addRow([
    "Horas noturnas: período das 22h às 5h (art. 73 da CLT), em hora-relógio. Feriado trabalhado: feriado cadastrado no sistema em que houve batida de ponto. Faltas e atestados: lançados em Funcionários → Folgas/faltas.",
  ]);
  ws.mergeCells(legenda.number, 1, legenda.number, header.length);
  legenda.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  legenda.getCell(1).alignment = { wrapText: true };
  legenda.height = 30;

  ws.views = [{ state: "frozen", ySplit: 6 }];
}

function nomeAba(nome: string, usados: Set<string>) {
  // Excel: até 31 caracteres, sem : \ / ? * [ ] e nomes únicos.
  const base = nome.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || "Funcionário";
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) candidato = `${base.slice(0, 26)} ${i}`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

function abaFuncionario(
  wb: ExcelJS.Workbook,
  f: FuncionarioPonto,
  empresa: Empresa,
  periodo: string,
  usados: Set<string>,
) {
  const ws = wb.addWorksheet(nomeAba(f.name, usados), {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const header = [
    "Data",
    "Dia",
    "Entrada",
    "Saída",
    "Horas trabalhadas",
    "Horas diurnas",
    "Horas noturnas",
    "Feriado",
    "Situação",
    "Observação",
  ];
  ws.columns = [11, 7, 13, 13, 11, 11, 11, 18, 18, 30].map((width) => ({ width }));
  cabecalhoEmpresa(ws, empresa, "Espelho de Ponto", periodo, header.length);

  const dados: [string, string][] = [
    ["Funcionário", f.name],
    ["Cargo", f.role ?? "—"],
    ["Loja", f.storeName ?? "—"],
    ["Admissão", f.hireDate ? formatDiaBR(f.hireDate) : "—"],
    [
      "Horário previsto",
      f.scheduledStart || f.scheduledEnd ? `${f.scheduledStart ?? "?"} às ${f.scheduledEnd ?? "?"}` : "—",
    ],
    ["Folga semanal", f.weeklyDayOff !== null ? WEEKDAY_LONG[f.weeklyDayOff] : "—"],
  ];
  for (const [k, v] of dados) {
    const row = ws.addRow([k, "", v]);
    ws.mergeCells(row.number, 1, row.number, 2);
    ws.mergeCells(row.number, 3, row.number, header.length);
    row.getCell(1).font = { bold: true };
  }
  ws.addRow([]);

  estiloCabecalhoTabela(ws.addRow(header));
  const headerRow = ws.rowCount;
  const primeira = headerRow + 1;
  for (const d of f.dias) {
    const row = ws.addRow([
      formatDiaBR(d.date),
      WEEKDAY_SHORT[d.weekday],
      d.batidas.map((b) => b.entrada).join(" / "),
      d.batidas.map((b) => b.saida ?? "?").join(" / "),
      d.horas ? toExcelHoras(d.horas) : null,
      d.horas ? toExcelHoras(d.horas - d.horasNoturnas) : null,
      d.horasNoturnas ? toExcelHoras(d.horasNoturnas) : null,
      d.feriado ?? "",
      SITUACAO_LABEL[d.situacao],
      d.obs ?? "",
    ]);
    const cor =
      d.situacao === "FALTA"
        ? COR.falta
        : d.situacao === "ATESTADO"
          ? COR.atestado
          : d.feriado
            ? COR.feriado
            : d.situacao === "SEM_REGISTRO" || d.situacao === "EM_ABERTO"
              ? COR.semRegistro
              : d.situacao === "FOLGA"
                ? COR.folga
                : null;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borda;
      cell.alignment = { vertical: "top", wrapText: true };
      if (cor) cell.fill = fill(cor);
    });
    [5, 6, 7].forEach((c) => (row.getCell(c).numFmt = HORA_FMT));
    if (d.situacao === "FALTA") row.getCell(9).font = { bold: true, color: { argb: "FFB91C1C" } };
  }
  const ultima = ws.rowCount;

  const total = ws.addRow([
    "TOTAL",
    "",
    `${f.diasTrabalhados} dias trabalhados`,
    "",
    { formula: `SUM(E${primeira}:E${ultima})`, result: toExcelHoras(f.totalHoras) },
    { formula: `SUM(F${primeira}:F${ultima})`, result: toExcelHoras(f.totalHoras - f.totalNoturnas) },
    { formula: `SUM(G${primeira}:G${ultima})`, result: toExcelHoras(f.totalNoturnas) },
    `${f.feriadosTrabalhados.length} feriado(s) trab.`,
    `${f.faltas.length} falta(s) · ${f.atestados.length} atestado(s)`,
    `${f.folgas} folga(s)`,
  ]);
  ws.mergeCells(total.number, 3, total.number, 4);
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.fill = fill(COR.total);
    cell.border = borda;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  [5, 6, 7].forEach((c) => (total.getCell(c).numFmt = HORA_FMT));

  ws.addRow([]);
  const legenda = ws.addRow([
    "Cores: vermelho = falta · azul = atestado · amarelo = feriado · laranja = sem registro · cinza = folga",
  ]);
  ws.mergeCells(legenda.number, 1, legenda.number, header.length);
  legenda.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

  ws.addRow([]);
  ws.addRow([]);
  const assinatura = ws.addRow(["", "", "______________________________", "", "", "", "______________________________"]);
  ws.mergeCells(assinatura.number, 3, assinatura.number, 5);
  ws.mergeCells(assinatura.number, 7, assinatura.number, 9);
  const nomes = ws.addRow(["", "", f.name, "", "", "", "Responsável pela empresa"]);
  ws.mergeCells(nomes.number, 3, nomes.number, 5);
  ws.mergeCells(nomes.number, 7, nomes.number, 9);
  [assinatura, nomes].forEach((r) =>
    [3, 7].forEach((c) => (r.getCell(c).alignment = { horizontal: "center" })),
  );

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
}

/** Monta o .xlsx: aba "Resumo" + uma aba (espelho de ponto) por funcionário. */
export async function buildPontoWorkbook(relatorio: FuncionarioPonto[], empresa: Empresa, mes: string) {
  const [ano, mesNum] = mes.split("-").map(Number);
  const mm = String(mesNum).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const periodo = `Período: ${MESES[mesNum - 1]} de ${ano} (01/${mm}/${ano} a ${ultimoDia}/${mm}/${ano})`;

  const wb = new ExcelJS.Workbook();
  wb.creator = empresa.nome || "Sistema de gestão";
  wb.created = new Date();
  abaResumo(wb, relatorio, empresa, periodo);
  const usados = new Set(["resumo"]);
  for (const f of relatorio) abaFuncionario(wb, f, empresa, periodo, usados);

  const buffer = await wb.xlsx.writeBuffer();
  const sufixo =
    relatorio.length === 1 ? `-${relatorio[0].name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}` : "";
  return { buffer, filename: `ponto-${MESES[mesNum - 1].toLowerCase()}-${ano}${sufixo}.xlsx` };
}
