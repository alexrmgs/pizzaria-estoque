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
import { DeleteValeButton } from "./delete-vale-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Advance = {
  id: string;
  employeeName: string;
  date: string;
  amount: number;
  description: string | null;
  paymentId: string | null;
};

export function ValeMonthSection({
  monthLabel,
  advances,
  totalAmount,
  pendingAmount,
  defaultOpen,
}: {
  monthLabel: string;
  advances: Advance[];
  totalAmount: number;
  pendingAmount: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          {monthLabel}
        </CardTitle>
        <div className="text-sm text-neutral-500">
          {advances.length} vale{advances.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-primary">{currency(totalAmount)}</span>
          {pendingAmount > 0 && (
            <>
              {" "}
              · <span className="text-destructive">{currency(pendingAmount)} pendente</span>
            </>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-medium">{advance.employeeName}</TableCell>
                    <TableCell>{advance.date}</TableCell>
                    <TableCell>{currency(advance.amount)}</TableCell>
                    <TableCell className="text-neutral-500">{advance.description ?? "—"}</TableCell>
                    <TableCell>
                      {advance.paymentId ? (
                        <Badge variant="secondary">Pago</Badge>
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!advance.paymentId && <DeleteValeButton id={advance.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
