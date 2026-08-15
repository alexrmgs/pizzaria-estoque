"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { criarEmpresa } from "./actions";

export function CompanyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await criarEmpresa(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        toast.success("Empresa criada ✅");
        router.refresh();
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
      <DialogTrigger render={<Button size="sm">+ Nova empresa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input id="companyName" name="companyName" placeholder="Ex: Pizzaria do João" required />
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase">
              Primeiro acesso (administrador)
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminName">Nome</Label>
                <Input id="adminName" name="adminName" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminEmail">E-mail</Label>
                <Input id="adminEmail" name="adminEmail" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adminPassword">Senha</Label>
                <Input id="adminPassword" name="adminPassword" type="password" required minLength={6} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
