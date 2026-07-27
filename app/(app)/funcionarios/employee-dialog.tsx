"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEmployee, updateEmployee } from "./actions";

const WEEKDAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

type Employee = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  baseSalary: string;
  dependents: number;
  hireDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  weeklyDayOff: number | null;
  active: boolean;
  userId: string | null;
  storeId: string | null;
};

type AvailableUser = { id: string; name: string; email: string };
type Store = { id: string; name: string };

export function EmployeeDialog({
  employee,
  availableUsers,
  stores,
}: {
  employee?: Employee;
  availableUsers: AvailableUser[];
  stores: Store[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = employee
        ? await updateEmployee(employee.id, undefined, formData)
        : await createEmployee(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button variant={employee ? "outline" : "default"} size="sm">
            {employee ? "Editar" : "+ Novo funcionário"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={employee?.name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Cargo/função</Label>
              <Input
                id="role"
                name="role"
                defaultValue={employee?.role ?? ""}
                placeholder="Ex: Cozinheiro"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="baseSalary">Salário fixo (R$)</Label>
              <Input
                id="baseSalary"
                name="baseSalary"
                type="number"
                step="0.01"
                min="0"
                defaultValue={employee?.baseSalary}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hireDate">Data de admissão</Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={employee?.hireDate ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dependents">Dependentes (IR)</Label>
            <Input
              id="dependents"
              name="dependents"
              type="number"
              step="1"
              min="0"
              className="w-32"
              defaultValue={employee?.dependents ?? 0}
            />
            <p className="-mt-1 text-xs text-muted-foreground">
              Usado no cálculo da dedução de IRRF, se marcado no fechamento do pagamento.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduledStart">Horário de entrada</Label>
              <Input
                id="scheduledStart"
                name="scheduledStart"
                type="time"
                defaultValue={employee?.scheduledStart ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduledEnd">Horário de saída</Label>
              <Input
                id="scheduledEnd"
                name="scheduledEnd"
                type="time"
                defaultValue={employee?.scheduledEnd ?? ""}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Usado para calcular atraso quando ele bate o ponto (opcional).
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="weeklyDayOff">Folga fixa semanal</Label>
            <Select
              name="weeklyDayOff"
              autoComplete="off"
              defaultValue={employee?.weeklyDayOff != null ? String(employee.weeklyDayOff) : "none"}
              items={[{ value: "none", label: "Sem folga fixa" }, ...WEEKDAYS]}
            >
              <SelectTrigger id="weeklyDayOff" className="w-full">
                <SelectValue placeholder="Sem folga fixa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem folga fixa</SelectItem>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Esse dia da semana fica marcado como folga automaticamente — não conta como falta se
              ele não bater o ponto.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="userId">Conta de acesso ao sistema</Label>
            <Select
              name="userId"
              autoComplete="off"
              defaultValue={employee?.userId ?? "none"}
              items={[
                { value: "none", label: "Sem acesso ao sistema" },
                ...availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
              ]}
            >
              <SelectTrigger id="userId" className="w-full">
                <SelectValue placeholder="Sem acesso ao sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem acesso ao sistema</SelectItem>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vincule a um usuário (crie um em Usuários primeiro) pra ele bater o próprio ponto e
              ver seus vales em &quot;Meu Ponto&quot;.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="storeId">Loja</Label>
            <Select
              name="storeId"
              autoComplete="off"
              defaultValue={employee?.storeId ?? "none"}
              items={[
                { value: "none", label: "Sem loja vinculada" },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
              ]}
            >
              <SelectTrigger id="storeId" className="w-full">
                <SelectValue placeholder="Sem loja vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem loja vinculada</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado para confirmar a localização quando ele bater o ponto.
            </p>
          </div>

          <label htmlFor="active" className="flex items-center gap-2">
            <Checkbox id="active" name="active" defaultChecked={employee?.active ?? true} />
            <span className="text-sm font-medium">Ativo</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
