"use client";

import { Button } from "@/components/ui/button";

const BOM = "﻿";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ExportCsvButton({ names }: { names: string[] }) {
  function handleClick() {
    const lines = ["Produto", ...names.map(csvEscape)];
    // BOM no início pra acentuação abrir certo no Excel.
    const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produtos-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" type="button" onClick={handleClick}>
      Exportar CSV
    </Button>
  );
}
