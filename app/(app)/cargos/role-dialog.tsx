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
import { createRole, updateRole } from "./actions";
import { RH_PAGINAS } from "@/lib/paginas-avulsas";

type Role = {
  id: string;
  name: string;
  canManageEstoque: boolean;
  canManageReceitas: boolean;
  canManageUsuarios: boolean;
  canViewRelatorios: boolean;
  canManageFuncionarios: boolean;
  canPrintEtiquetas: boolean;
  canPrintProducao: boolean;
  paginas: string[];
};

const PERMISSIONS: { key: keyof Omit<Role, "id" | "name" | "paginas">; label: string; hint: string }[] = [
  {
    key: "canManageEstoque",
    label: "Estoque",
    hint: "Cadastrar/editar ingredientes, categorias e preços",
  },
  {
    key: "canManageReceitas",
    label: "Receitas",
    hint: "Criar e editar fichas técnicas",
  },
  {
    key: "canViewRelatorios",
    label: "Relatórios",
    hint: "Ver histórico de movimentações de estoque",
  },
  {
    key: "canManageUsuarios",
    label: "Usuários",
    hint: "Criar/editar usuários e gerenciar cargos",
  },
  {
    key: "canManageFuncionarios",
    label: "Funcionários",
    hint: "Ponto, vales, bônus/descontos e pagamentos da equipe",
  },
  {
    key: "canPrintEtiquetas",
    label: "Etiquetas — Pedidos (atendimento)",
    hint: "Acessa só a tela de etiquetas de pedidos — pra estação do atendimento",
  },
  {
    key: "canPrintProducao",
    label: "Etiquetas — Produção (cozinha)",
    hint: "Acessa só a tela de etiquetas de produção — pra estação da cozinha",
  },
];

export function RoleDialog({ role }: { role?: Role }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [rhInteiro, setRhInteiro] = useState(role?.canManageFuncionarios ?? false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = role
        ? await updateRole(role.id, undefined, formData)
        : await createRole(undefined, formData);
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
          <Button variant={role ? "outline" : "default"} size="sm">
            {role ? "Editar" : "+ Novo cargo"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? "Editar cargo" : "Novo cargo"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome do cargo</Label>
            <Input id="name" name="name" defaultValue={role?.name} placeholder="Ex: Gerente" required />
          </div>

          <div className="flex flex-col gap-3">
            <Label>Permissões</Label>
            {PERMISSIONS.map((permission) => (
              <label
                key={permission.key}
                htmlFor={permission.key}
                className="group/field flex items-start gap-2"
              >
                <Checkbox
                  id={permission.key}
                  name={permission.key}
                  defaultChecked={role?.[permission.key] ?? false}
                  onCheckedChange={
                    permission.key === "canManageFuncionarios"
                      ? (checked) => setRhInteiro(checked === true)
                      : undefined
                  }
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{permission.label}</span>
                  <span className="text-xs text-muted-foreground">{permission.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {!rhInteiro && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <Label>Telas avulsas do RH</Label>
              <p className="text-xs text-muted-foreground">
                Libera só a tela marcada, sem o RH inteiro — ex: só o Ponto por Facial pro
                tablet da loja.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {RH_PAGINAS.map((p) => (
                  <label key={p.href} htmlFor={`pg-${p.href}`} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`pg-${p.href}`}
                      name="paginas"
                      value={p.href}
                      defaultChecked={role?.paginas.includes(p.href) ?? false}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          )}

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
