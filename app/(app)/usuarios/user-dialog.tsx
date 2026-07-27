"use client";

import { useRef, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser, updateUser } from "./actions";

type User = {
  id: string;
  name: string;
  email: string;
  roleId: string;
};

type Role = { id: string; name: string };

export function UserDialog({ user, roles }: { user?: User; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = user
        ? await updateUser(user.id, undefined, formData)
        : await createUser(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        formRef.current?.reset();
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
          <Button variant={user ? "outline" : "default"} size="sm">
            {user ? "Editar" : "+ Novo usuário"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Editar usuário" : "Novo usuário"}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={user?.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={user?.email} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha{user ? " (opcional)" : ""}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              placeholder={user ? "Deixe em branco para manter a atual" : undefined}
              required={!user}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="roleId">Cargo</Label>
            <Select
              name="roleId"
              autoComplete="off"
              defaultValue={user?.roleId ?? roles[0]?.id}
              required
              items={roles.map((role) => ({ value: role.id, label: role.name }))}
            >
              <SelectTrigger id="roleId">
                <SelectValue placeholder="Selecione um cargo" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : user ? "Salvar" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
