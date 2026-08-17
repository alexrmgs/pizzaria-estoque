"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAdvance } from "./actions";
import { todayInBrazil } from "@/lib/payroll";

function todayISO() {
  return todayInBrazil().toISOString().slice(0, 10);
}

type Employee = { id: string; name: string };

export function ValeForm({ employees }: { employees: Employee[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createAdvance(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Vale lançado.");
        formRef.current?.reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Lançar vale</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="employeeId" className="text-xs">
              Funcionário
            </Label>
            <Select
              name="employeeId"
              autoComplete="off"
              required
              items={employees.map((e) => ({ value: e.id, label: e.name }))}
            >
              <SelectTrigger id="employeeId" className="h-9 w-52">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
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
            <Input id="description" name="description" placeholder="Ex: pizza broto" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="formaPagamento" className="text-xs">
              Forma de pagamento
            </Label>
            <select
              id="formaPagamento"
              name="formaPagamento"
              defaultValue="DINHEIRO"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">Pix</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Lançar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
