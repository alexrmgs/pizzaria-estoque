"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { addAdvance, deleteAdvance } from "./actions";
import { todayInBrazil } from "@/lib/payroll";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayISO() {
  return todayInBrazil().toISOString().slice(0, 10);
}

type Advance = {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  settled: boolean;
};

export function AdvancesSection({
  employeeId,
  advances,
}: {
  employeeId: string;
  advances: Advance[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addAdvance(employeeId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Vale registrado.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAdvance(employeeId, id);
      toast.success("Vale removido.");
    });
  }

  const pendingTotal = advances.filter((a) => !a.settled).reduce((sum, a) => sum + a.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Vales
          <span className="text-sm font-normal text-neutral-500">
            (pendente: {currency(pendingTotal)})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
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
            <Input id="description" name="description" placeholder="Ex: pizza broto" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Lançar vale
          </Button>
        </form>

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
              {advances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-neutral-500">
                    Nenhum vale lançado ainda.
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
                  <TableCell className="text-right">
                    {!advance.settled && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={() => {
                          if (confirm("Excluir este vale?")) handleDelete(advance.id);
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
