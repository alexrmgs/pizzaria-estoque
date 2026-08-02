"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShiftDuration } from "@/lib/payroll";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type TimeEntryRow = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
};

type AdvanceRow = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  settled: boolean;
};

type AdjustmentRow = {
  id: string;
  type: "BONUS" | "DESCONTO";
  date: string;
  amount: number;
  description: string | null;
  settled: boolean;
};

export function MonthOverviewSection({
  monthLabel,
  timeEntries,
  advances,
  adjustments,
}: {
  monthLabel: string;
  timeEntries: TimeEntryRow[];
  advances: AdvanceRow[];
  adjustments: AdjustmentRow[];
}) {
  const [open, setOpen] = useState(false);

  const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
  const bonusTotal = adjustments
    .filter((a) => a.type === "BONUS")
    .reduce((sum, a) => sum + a.amount, 0);
  const discountTotal = adjustments
    .filter((a) => a.type === "DESCONTO")
    .reduce((sum, a) => sum + a.amount, 0);

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          Visão do mês — {monthLabel}
        </CardTitle>
        <div className="text-sm text-neutral-500">
          {timeEntries.length} ponto{timeEntries.length === 1 ? "" : "s"} · {advances.length} vale
          {advances.length === 1 ? "" : "s"} ({currency(advancesTotal)}) · {adjustments.length} ajuste
          {adjustments.length === 1 ? "" : "s"}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-500">Ponto do mês</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-neutral-500">
                        Nenhum ponto batido esse mês ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>{entry.clockIn}</TableCell>
                      <TableCell>{entry.clockOut ?? "—"}</TableCell>
                      <TableCell className="text-neutral-500">
                        {entry.hours !== null ? formatShiftDuration(entry.hours) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-500">
              Vales do mês ({currency(advancesTotal)})
            </h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-neutral-500">
                        Nenhum vale lançado esse mês ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {advances.map((advance) => (
                    <TableRow key={advance.id}>
                      <TableCell>{advance.date}</TableCell>
                      <TableCell>{currency(advance.amount)}</TableCell>
                      <TableCell className="text-neutral-500">{advance.description ?? "—"}</TableCell>
                      <TableCell>
                        {advance.settled ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : (
                          <Badge variant="destructive">Pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-500">
              Bônus ({currency(bonusTotal)}) e descontos ({currency(discountTotal)}) do mês
            </h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-neutral-500">
                        Nenhum bônus ou desconto lançado esse mês ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell>{adjustment.date}</TableCell>
                      <TableCell>
                        {adjustment.type === "BONUS" ? (
                          <Badge className="bg-primary/15 text-primary">Bônus</Badge>
                        ) : (
                          <Badge variant="destructive">Desconto</Badge>
                        )}
                      </TableCell>
                      <TableCell>{currency(adjustment.amount)}</TableCell>
                      <TableCell className="text-neutral-500">
                        {adjustment.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {adjustment.settled ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : (
                          <Badge variant="destructive">Pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
