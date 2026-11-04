"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  carteiraAssinada: boolean;
  userId: string | null;
  storeId: string | null;
  matricula: string | null;
  cpf: string | null;
  cbo: string | null;
  departamento: string | null;
  filial: string | null;
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? `Editar — ${employee.name}` : "Novo funcionário"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-5">
          <Secao titulo="Dados pessoais">
            <Campo id="name" label="Nome completo" span>
              <Input id="name" name="name" defaultValue={employee?.name} required />
            </Campo>
            <Campo id="role" label="Cargo">
              <Input id="role" name="role" defaultValue={employee?.role ?? ""} placeholder="Ex: Pizzaiolo" />
            </Campo>
            <Campo id="phone" label="Telefone (WhatsApp)">
              <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} placeholder="(85) 99999-9999" />
            </Campo>
            <Campo id="cpf" label="CPF">
              <Input id="cpf" name="cpf" defaultValue={employee?.cpf ?? ""} placeholder="000.000.000-00" />
            </Campo>
          </Secao>

          <Secao titulo="Trabalho">
            <Campo id="baseSalary" label="Salário (R$)">
              <Input
                id="baseSalary"
                name="baseSalary"
                type="number"
                step="0.01"
                min="0"
                defaultValue={employee?.baseSalary}
                required
              />
            </Campo>
            <Campo id="hireDate" label="Admissão">
              <Input id="hireDate" name="hireDate" type="date" defaultValue={employee?.hireDate ?? ""} />
            </Campo>
            <Campo id="scheduledStart" label="Entrada">
              <Input
                id="scheduledStart"
                name="scheduledStart"
                type="time"
                defaultValue={employee?.scheduledStart ?? ""}
              />
            </Campo>
            <Campo id="scheduledEnd" label="Saída">
              <Input id="scheduledEnd" name="scheduledEnd" type="time" defaultValue={employee?.scheduledEnd ?? ""} />
            </Campo>
            <Campo id="weeklyDayOff" label="Folga fixa">
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
            </Campo>
            <Campo id="storeId" label="Loja">
              <Select
                name="storeId"
                autoComplete="off"
                defaultValue={employee?.storeId ?? "none"}
                items={[
                  { value: "none", label: "Sem loja" },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
              >
                <SelectTrigger id="storeId" className="w-full">
                  <SelectValue placeholder="Sem loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem loja</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
              <label htmlFor="carteiraAssinada" className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  id="carteiraAssinada"
                  name="carteiraAssinada"
                  defaultChecked={employee?.carteiraAssinada ?? true}
                />
                Carteira assinada
              </label>
              <label htmlFor="active" className="flex items-center gap-2 text-sm font-medium">
                <Checkbox id="active" name="active" defaultChecked={employee?.active ?? true} />
                Ativo
              </label>
            </div>
          </Secao>

          <Secao titulo="Contracheque" dica="Copie do holerite da contabilidade.">
            <Campo id="matricula" label="Código">
              <Input id="matricula" name="matricula" defaultValue={employee?.matricula ?? ""} />
            </Campo>
            <Campo id="cbo" label="CBO">
              <Input id="cbo" name="cbo" defaultValue={employee?.cbo ?? ""} />
            </Campo>
            <Campo id="departamento" label="Departamento">
              <Input id="departamento" name="departamento" defaultValue={employee?.departamento ?? ""} />
            </Campo>
            <Campo id="filial" label="Filial">
              <Input id="filial" name="filial" defaultValue={employee?.filial ?? ""} />
            </Campo>
            <Campo id="dependents" label="Dependentes (IR)">
              <Input
                id="dependents"
                name="dependents"
                type="number"
                step="1"
                min="0"
                defaultValue={employee?.dependents ?? 0}
              />
            </Campo>
          </Secao>

          <Secao titulo="Acesso ao sistema" dica="Pra ele ver o próprio ponto e os vales em Meu Ponto. Crie o usuário em Usuários antes.">
            <Campo id="userId" label="Usuário" span>
              <Select
                name="userId"
                autoComplete="off"
                defaultValue={employee?.userId ?? "none"}
                items={[
                  { value: "none", label: "Sem acesso" },
                  ...availableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
                ]}
              >
                <SelectTrigger id="userId" className="w-full">
                  <SelectValue placeholder="Sem acesso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem acesso</SelectItem>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </Secao>

          <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-xl border-t bg-popover px-4 py-3">
            {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </fieldset>
  );
}

function Campo({
  id,
  label,
  span,
  children,
}: {
  id: string;
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
