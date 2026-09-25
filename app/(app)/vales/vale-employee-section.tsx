"use client";

import { Fragment, useState } from "react";
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
import { DeleteValeButton } from "./delete-vale-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Vale = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  paymentId: string | null;
};
type MonthGroup = { key: string; label: string; vales: Vale[] };

export function ValeEmployeeSection({
  employeeName,
  months,
  pendingTotal,
  pendingCount,
  defaultOpen,
}: {
  employeeName: string;
  months: MonthGroup[];
  pendingTotal: number;
  pendingCount: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalVales = months.reduce((sum, m) => sum + m.vales.length, 0);

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          {employeeName}
          <span className="text-sm font-normal text-neutral-500">
            {totalVales} vale{totalVales === 1 ? "" : "s"}
          </span>
        </CardTitle>
        <div className="text-sm text-neutral-500">
          {pendingTotal > 0 ? (
            <>
              {pendingCount} pendente{pendingCount === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold text-destructive">{currency(pendingTotal)}</span>
            </>
          ) : (
            "Nada pendente"
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => {
                  const totalMes = month.vales.reduce((sum, v) => sum + v.amount, 0);
                  return (
                    <Fragment key={month.key}>
                      <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                        <TableCell colSpan={5} className="font-medium capitalize">
                          {month.label}{" "}
                          <span className="font-normal text-neutral-500">
                            ({month.vales.length} vale{month.vales.length === 1 ? "" : "s"} ·{" "}
                            {currency(totalMes)})
                          </span>
                        </TableCell>
                      </TableRow>
                      {month.vales.map((vale) => (
                        <TableRow key={vale.id}>
                          <TableCell>{vale.date.split("-").reverse().join("/")}</TableCell>
                          <TableCell>{currency(vale.amount)}</TableCell>
                          <TableCell className="text-neutral-500">
                            {vale.description ?? "—"}
                          </TableCell>
                          <TableCell>
                            {vale.paymentId ? (
                              <Badge variant="secondary">Pago</Badge>
                            ) : (
                              <Badge variant="destructive">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!vale.paymentId && <DeleteValeButton id={vale.id} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
