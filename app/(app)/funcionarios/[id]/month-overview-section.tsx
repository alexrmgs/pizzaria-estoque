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

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type AdjustmentItem = { id: string; date: string; amount: number; description: string | null };
type AdvanceItem = { id: string; date: string; amount: number; description: string | null };

export function MonthOverviewSection({
  periodStart,
  periodEnd,
  baseSalary,
  totalNightHours,
  nightPremium,
  overtimeMode,
  overtimeHours,
  overtimeAmount,
  bankedHours,
  netAmount,
  bonusTotal,
  bonusItems,
  discountTotal,
  discountItems,
  advancesTotal,
  advanceItems,
}: {
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  totalNightHours: number;
  nightPremium: number;
  overtimeMode: "HORA_EXTRA" | "BANCO_HORAS";
  overtimeHours: number;
  overtimeAmount: number;
  bankedHours: number;
  netAmount: number;
  bonusTotal: number;
  bonusItems: AdjustmentItem[];
  discountTotal: number;
  discountItems: AdjustmentItem[];
  advancesTotal: number;
  advanceItems: AdvanceItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          Visualizar ganhos e vales
        </CardTitle>
        <div className="text-sm text-neutral-500">
          Líquido previsto: <span className="font-semibold text-primary">{currency(netAmount)}</span>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-500">
              Meus ganhos (período: {periodStart} a {periodEnd}, desde o último pagamento)
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-neutral-500">Salário base</p>
                <p className="text-lg font-semibold">{currency(baseSalary)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-neutral-500">Adicional noturno ({totalNightHours.toFixed(2)}h)</p>
                <p className="text-lg font-semibold text-primary">{currency(nightPremium)}</p>
              </div>
              {overtimeMode === "HORA_EXTRA" ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Hora extra ({overtimeHours.toFixed(2)}h)</p>
                  <p className="text-lg font-semibold text-primary">{currency(overtimeAmount)}</p>
                </div>
              ) : (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-neutral-500">Banco de horas</p>
                  <p className="text-lg font-semibold">{bankedHours.toFixed(2)}h</p>
                </div>
              )}
              <div className="rounded-lg border p-3">
                <p className="text-xs text-neutral-500">Líquido previsto</p>
                <p className="text-lg font-semibold text-primary">{currency(netAmount)}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-neutral-500">Bônus ({currency(bonusTotal)})</p>
                {bonusItems.length === 0 ? (
                  <p className="text-sm text-neutral-400">Nenhum bônus no período.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {bonusItems.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="text-neutral-500">
                          {item.date} {item.description ? `· ${item.description}` : ""}
                        </span>
                        <span className="font-medium text-primary">{currency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-neutral-500">
                  Descontos ({currency(discountTotal)})
                </p>
                {discountItems.length === 0 ? (
                  <p className="text-sm text-neutral-400">Nenhum desconto no período.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {discountItems.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="text-neutral-500">
                          {item.date} {item.description ? `· ${item.description}` : ""}
                        </span>
                        <span className="font-medium text-destructive">-{currency(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-400">
              Vales pendentes descontam do próximo pagamento — veja o detalhamento abaixo. Total
              pendente: {currency(advancesTotal)}.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-500">
              Meus vales (pendente: {currency(advancesTotal)})
            </p>
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
                  {advanceItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-neutral-500">
                        Nenhum vale pendente nesse período.
                      </TableCell>
                    </TableRow>
                  )}
                  {advanceItems.map((advance) => (
                    <TableRow key={advance.id}>
                      <TableCell>{advance.date}</TableCell>
                      <TableCell>{currency(advance.amount)}</TableCell>
                      <TableCell className="text-neutral-500">{advance.description ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Pendente</Badge>
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
