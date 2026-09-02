"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { ReopenPaymentButton } from "../funcionarios/reopen-payment-button";
import { ClosePaymentDialog, type CltSettings } from "../funcionarios/close-payment-dialog";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Payment = {
  id: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  advancesTotal: number;
  cltTotal: number;
  netAmount: number;
  paidAt: string;
};

export function PaymentMonthSection({
  monthLabel,
  payments,
  totalNet,
  defaultOpen,
  employeesById,
  cltSettings,
}: {
  monthLabel: string;
  payments: Payment[];
  totalNet: number;
  defaultOpen: boolean;
  employeesById: Map<string, { baseSalary: number; dependents: number }>;
  cltSettings: CltSettings;
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
          {payments.length} pagamento{payments.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-primary">{currency(totalNet)}</span>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Vales (com adiantamento)</TableHead>
                  <TableHead>Descontos CLT</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const emp = employeesById.get(payment.employeeId);
                  return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <Link href={`/funcionarios/${payment.employeeId}`} className="hover:underline">
                        {payment.employeeName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-neutral-500">
                      {payment.periodStart} a {payment.periodEnd}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {payment.advancesTotal > 0 ? currency(payment.advancesTotal) : "—"}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {payment.cltTotal > 0 ? currency(payment.cltTotal) : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {currency(payment.netAmount)}
                    </TableCell>
                    <TableCell className="text-neutral-500">{payment.paidAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link href={`/imprimir/contracheque/${payment.id}`} target="_blank" />
                          }
                        >
                          Contracheque
                        </Button>
                        <ClosePaymentDialog
                          employeeId={payment.employeeId}
                          employeeName={payment.employeeName}
                          baseSalary={emp?.baseSalary ?? 0}
                          dependents={emp?.dependents ?? 0}
                          cltSettings={cltSettings}
                          editingPayment={{
                            id: payment.id,
                            periodStart: payment.periodStart,
                            periodEnd: payment.periodEnd,
                          }}
                        />
                        <ReopenPaymentButton employeeId={payment.employeeId} paymentId={payment.id} />
                      </div>
                    </TableCell>
                  </TableRow>
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
