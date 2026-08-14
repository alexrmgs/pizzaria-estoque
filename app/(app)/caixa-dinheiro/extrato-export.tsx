"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  data: string;
  descricao: string;
  tipo: string;
  valor: number;
  saldo: number;
};

const brMoney = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ExtratoExport({
  rows,
  saldoInicial,
  saldoFinal,
  mesLabel,
  monthKey,
}: {
  rows: Row[];
  saldoInicial: number;
  saldoFinal: number;
  mesLabel: string;
  monthKey: string;
}) {
  function baixarCsv() {
    const linhas = [
      ["Data", "Descrição", "Tipo", "Entrada", "Saída", "Saldo"],
      ["", "SALDO INICIAL", "", "", "", brMoney(saldoInicial)],
      ...rows.map((r) => [
        r.data,
        r.descricao,
        r.tipo,
        r.valor >= 0 ? brMoney(r.valor) : "",
        r.valor < 0 ? brMoney(-r.valor) : "",
        brMoney(r.saldo),
      ]),
      ["", "SALDO FINAL", "", "", "", brMoney(saldoFinal)],
    ];
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM pra o Excel abrir com acento certo
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-caixa-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const linhasHtml = rows
      .map((r) => {
        const ent = r.valor >= 0 ? brMoney(r.valor) : "";
        const sai = r.valor < 0 ? brMoney(-r.valor) : "";
        return `<tr>
          <td>${r.data}</td>
          <td>${r.descricao}</td>
          <td class="t">${r.tipo}</td>
          <td class="num pos">${ent}</td>
          <td class="num neg">${sai}</td>
          <td class="num">${brMoney(r.saldo)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Extrato ${mesLabel}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;}
      h1{font-size:18px;margin:0;}
      .sub{color:#666;font-size:12px;margin:2px 0 16px;}
      .resumo{display:flex;gap:24px;margin-bottom:12px;font-size:13px;}
      .resumo b{display:block;font-size:15px;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;}
      th{background:#f3f3f3;text-transform:uppercase;font-size:10px;letter-spacing:.03em;}
      .num{text-align:right;font-variant-numeric:tabular-nums;}
      .pos{color:#047857;}
      .neg{color:#b91c1c;}
      .t{color:#666;}
      tfoot td{font-weight:bold;border-top:2px solid #999;}
    </style></head><body>
      <h1>Extrato do Caixa de Dinheiro</h1>
      <p class="sub">FB Pizzaria &amp; Esfiharia — ${mesLabel}</p>
      <div class="resumo">
        <span>Saldo inicial <b>R$ ${brMoney(saldoInicial)}</b></span>
        <span>Saldo final <b>R$ ${brMoney(saldoFinal)}</b></span>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="num">Entrada</th><th class="num">Saída</th><th class="num">Saldo</th></tr></thead>
        <tbody>
          <tr><td></td><td><b>SALDO INICIAL</b></td><td></td><td></td><td></td><td class="num">${brMoney(saldoInicial)}</td></tr>
          ${linhasHtml}
        </tbody>
        <tfoot><tr><td></td><td>SALDO FINAL</td><td></td><td></td><td></td><td class="num">${brMoney(saldoFinal)}</td></tr></tfoot>
      </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={baixarCsv} disabled={rows.length === 0}>
        <Download className="mr-1 size-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={imprimir} disabled={rows.length === 0}>
        <Printer className="mr-1 size-4" /> Extrato
      </Button>
    </div>
  );
}
