"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClosePaymentDialog, type CltSettings } from "../close-payment-dialog";
import { ReopenPaymentButton } from "../reopen-payment-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Payment = {
  id: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  nightPremium: number;
  overtimeHours: number;
  overtimeAmount: number;
  bankedHours: number;
  lateDiscountMinutes: number;
  lateDiscountAmount: number;
  faltaDays: number;
  faltaAmount: number;
  inssAmount: number;
  irrfAmount: number;
  valeTransporteAmount: number;
  bonusTotal: number;
  discountTotal: number;
  advancesTotal: number;
  netAmount: number;
  paidAt: string;
  note: string | null;
};

export function PaymentSection({
  employeeId,
  baseSalary,
  dependents,
  cltSettings,
  payments,
}: {
  employeeId: string;
  baseSalary: number;
  dependents: number;
  cltSettings: CltSettings;
  payments: Payment[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Folha de Pagamento</CardTitle>
        <ClosePaymentDialog
          employeeId={employeeId}
          baseSalary={baseSalary}
          dependents={dependents}
          cltSettings={cltSettings}
        />
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Adicional noturno</TableHead>
                <TableHead>Hora extra</TableHead>
                <TableHead>Banco de horas</TableHead>
                <TableHead>Desconto atraso</TableHead>
                <TableHead>Descontos CLT</TableHead>
                <TableHead>Bônus</TableHead>
                <TableHead>Descontos</TableHead>
                <TableHead>Vales</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-neutral-500">
                    Nenhum pagamento fechado ainda.
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => {
                const cltTotal =
                  payment.faltaAmount + payment.inssAmount + payment.irrfAmount + payment.valeTransporteAmount;
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.periodStart} a {payment.periodEnd}
                    </TableCell>
                    <TableCell>{currency(payment.baseSalary)}</TableCell>
                    <TableCell>{currency(payment.nightPremium)}</TableCell>
                    <TableCell>
                      {payment.overtimeHours > 0
                        ? `${payment.overtimeHours.toFixed(2)}h (${currency(payment.overtimeAmount)})`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {payment.bankedHours > 0 ? `${payment.bankedHours.toFixed(2)}h` : "—"}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {payment.lateDiscountMinutes > 0
                        ? `${payment.lateDiscountMinutes.toFixed(0)}min (${currency(payment.lateDiscountAmount)})`
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="text-destructive"
                      title={`Falta: ${currency(payment.faltaAmount)} · INSS: ${currency(payment.inssAmount)} · IRRF: ${currency(payment.irrfAmount)} · VT: ${currency(payment.valeTransporteAmount)}`}
                    >
                      {cltTotal > 0 ? currency(cltTotal) : "—"}
                    </TableCell>
                    <TableCell>{currency(payment.bonusTotal)}</TableCell>
                    <TableCell>{currency(payment.discountTotal)}</TableCell>
                    <TableCell>{currency(payment.advancesTotal)}</TableCell>
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
                        <ReopenPaymentButton employeeId={employeeId} paymentId={payment.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
