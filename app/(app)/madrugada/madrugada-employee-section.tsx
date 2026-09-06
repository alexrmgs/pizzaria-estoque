"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteMadrugadaButton } from "./delete-madrugada-button";
import { PayMadrugadaButton } from "./pay-madrugada-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Entry = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  paid: boolean;
};

export function MadrugadaEmployeeSection({
  employeeId,
  employeeName,
  entries,
  pendingTotal,
  pendingCount,
  defaultOpen,
}: {
  employeeId: string;
  employeeName: string;
  entries: Entry[];
  pendingTotal: number;
  pendingCount: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 text-left select-none"
        >
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <CardTitle className="text-lg">{employeeName}</CardTitle>
          <span className="text-sm font-normal text-neutral-500">
            {entries.length} lançamento{entries.length === 1 ? "" : "s"}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {pendingTotal > 0 ? (
            <>
              <span className="text-sm text-destructive">
                {pendingCount} pendente{pendingCount === 1 ? "" : "s"} · {currency(pendingTotal)}
              </span>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/imprimir/madrugada/${employeeId}`} target="_blank" />}
              >
                Comprovante
              </Button>
              <PayMadrugadaButton
                employeeId={employeeId}
                employeeName={employeeName}
                amount={pendingTotal}
              />
            </>
          ) : (
            <span className="text-sm text-neutral-500">Nada pendente</span>
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
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{currency(entry.amount)}</TableCell>
                    <TableCell className="text-neutral-500">{entry.description ?? "—"}</TableCell>
                    <TableCell>
                      {entry.paid ? (
                        <Badge variant="secondary">Pago</Badge>
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!entry.paid && <DeleteMadrugadaButton id={entry.id} />}
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
