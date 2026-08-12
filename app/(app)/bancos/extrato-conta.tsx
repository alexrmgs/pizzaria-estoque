"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Download } from "lucide-react";

type Transacao = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
};

const currency = (v: number, code = "BRL") =>
  v.toLocaleString("pt-BR", { style: "currency", currency: code || "BRL" });

const brDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ExtratoConta({
  transactions,
  sincronizando,
  extratoError,
  nome,
}: {
  transactions: Transacao[];
  sincronizando?: boolean;
  extratoError?: string;
  nome: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [periodo, setPeriodo] = useState<"7" | "30" | "90" | "custom">("90");
  const [tipo, setTipo] = useState<"todos" | "entradas" | "saidas">("todos");
  const [de, setDe] = useState(daysAgoISO(30));
  const [ate, setAte] = useState(daysAgoISO(0));

  const filtradas = useMemo(() => {
    let inicio: string;
    let fim = "9999-12-31";
    if (periodo === "custom") {
      inicio = de;
      fim = ate;
    } else {
      inicio = daysAgoISO(Number(periodo));
    }
    const q = query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return transactions.filter((t) => {
      const d = t.date.slice(0, 10);
      if (d < inicio || d > fim) return false;
      if (tipo === "entradas" && t.amount < 0) return false;
      if (tipo === "saidas" && t.amount >= 0) return false;
      if (q) {
        const desc = (t.description ?? "")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();
        if (!desc.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, periodo, tipo, de, ate]);

  const totalFiltrado = filtradas.reduce((s, t) => s + t.amount, 0);

  function exportarCSV() {
    const header = ["Data", "Descrição", "Valor"];
    const linhas = filtradas.map((t) => [
      brDate(t.date),
      (t.description ?? "").replace(/"/g, '""'),
      t.amount.toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...linhas]
      .map((r) => r.map((c) => `"${c}"`).join(";"))
      .join("\r\n");
    // BOM pra o Excel abrir com acento certo
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${nome}`.replace(/[^\w.-]+/g, "_").slice(0, 60) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-neutral-50"
      >
        <span className="flex items-center gap-2 text-neutral-600">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          Extrato
          {!sincronizando && !extratoError && (
            <span className="text-neutral-400">({transactions.length} lançamentos)</span>
          )}
        </span>
        <span className="text-xs text-neutral-400">{open ? "Recolher" : "Ver extrato"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {extratoError ? (
            <p className="text-sm text-red-600">Erro ao buscar extrato: {extratoError}</p>
          ) : sincronizando && transactions.length === 0 ? (
            <p className="text-sm text-neutral-500">
              A Pluggy ainda está puxando o extrato. Aguarde alguns minutos e atualize a página.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2 size-4 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar descrição…"
                    className="h-9 w-52 rounded-md border border-input pl-8 pr-2 text-sm"
                  />
                </div>
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
                  className="h-9 rounded-md border border-input px-2 text-sm"
                >
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
                {periodo === "custom" && (
                  <>
                    <input
                      type="date"
                      value={de}
                      onChange={(e) => setDe(e.target.value)}
                      className="h-9 rounded-md border border-input px-2 text-sm"
                    />
                    <span className="text-xs text-neutral-400">até</span>
                    <input
                      type="date"
                      value={ate}
                      onChange={(e) => setAte(e.target.value)}
                      className="h-9 rounded-md border border-input px-2 text-sm"
                    />
                  </>
                )}
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                  className="h-9 rounded-md border border-input px-2 text-sm"
                >
                  <option value="todos">Tudo</option>
                  <option value="entradas">Só entradas</option>
                  <option value="saidas">Só saídas</option>
                </select>
                <button
                  type="button"
                  onClick={exportarCSV}
                  disabled={filtradas.length === 0}
                  className="flex h-9 items-center gap-1 rounded-md border border-input px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Download className="size-4" /> Exportar
                </button>
              </div>

              <div className="mb-2 text-xs text-neutral-500">
                {filtradas.length} lançamento(s) · saldo do filtro:{" "}
                <b className={totalFiltrado < 0 ? "text-red-600" : "text-emerald-600"}>
                  {currency(totalFiltrado)}
                </b>
              </div>

              {filtradas.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhum lançamento com esses filtros.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-neutral-50">
                      <tr className="text-left text-xs text-neutral-500">
                        <th className="p-2">Data</th>
                        <th className="p-2">Descrição</th>
                        <th className="p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="p-2 whitespace-nowrap text-neutral-500">{brDate(t.date)}</td>
                          <td className="p-2">{t.description}</td>
                          <td
                            className={
                              "p-2 text-right font-medium " +
                              (t.amount < 0 ? "text-red-600" : "text-emerald-600")
                            }
                          >
                            {currency(t.amount, t.currencyCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
