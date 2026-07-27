"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addAdjustment, deleteAdjustment } from "./actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Adjustment = {
  id: string;
  type: "BONUS" | "DESCONTO";
  date: string;
  amount: number;
  description: string | null;
  settled: boolean;
};

export function AdjustmentsSection({
  employeeId,
  adjustments,
}: {
  employeeId: string;
  adjustments: Adjustment[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addAdjustment(employeeId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Lançamento registrado.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAdjustment(employeeId, id);
      toast.success("Lançamento removido.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bônus e descontos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="type" className="text-xs">
              Tipo
            </Label>
            <Select
              name="type"
              autoComplete="off"
              defaultValue="BONUS"
              required
              items={[
                { value: "BONUS", label: "Bônus" },
                { value: "DESCONTO", label: "Desconto (ex: falta)" },
              ]}
            >
              <SelectTrigger id="type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BONUS">Bônus</SelectItem>
                <SelectItem value="DESCONTO">Desconto (ex: falta)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="date" className="text-xs">
              Data
            </Label>
            <Input id="date" name="date" type="date" defaultValue={todayISO()} required className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="amount" className="text-xs">
              Valor (R$)
            </Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" required className="h-9 w-32" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="description" className="text-xs">
              Descrição
            </Label>
            <Input id="description" name="description" placeholder="Ex: falta dia 12" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Lançar
          </Button>
        </form>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-neutral-500">
                    Nenhum lançamento ainda.
                  </TableCell>
                </TableRow>
              )}
              {adjustments.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell>
                    {adjustment.type === "BONUS" ? (
                      <Badge variant="secondary">Bônus</Badge>
                    ) : (
                      <Badge variant="destructive">Desconto</Badge>
                    )}
                  </TableCell>
                  <TableCell>{adjustment.date}</TableCell>
                  <TableCell>{currency(adjustment.amount)}</TableCell>
                  <TableCell className="text-neutral-500">
                    {adjustment.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {adjustment.settled ? (
                      <Badge variant="secondary">Pago</Badge>
                    ) : (
                      <span className="text-sm text-neutral-500">Pendente</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!adjustment.settled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          if (confirm("Excluir este lançamento?")) handleDelete(adjustment.id);
                        }}
                      >
                        Excluir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
