"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLabelEmpresa } from "./actions";

export function LabelEmpresaForm({
  empresa,
  cnpj,
  endereco,
  cep,
  cidade,
}: {
  empresa: string;
  cnpj: string;
  endereco: string;
  cep: string;
  cidade: string;
}) {
  const [values, setValues] = useState({ empresa, cnpj, endereco, cep, cidade });
  const [isPending, startTransition] = useTransition();

  function set(key: keyof typeof values, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateLabelEmpresa(values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Dados da loja salvos.");
      }
    });
  }

  const fields: { key: keyof typeof values; label: string; placeholder: string }[] = [
    { key: "empresa", label: "Nome / Razão social", placeholder: "FB Pizzaria & Esfiharia" },
    { key: "cnpj", label: "CNPJ", placeholder: "12.345.678/0001-90" },
    { key: "endereco", label: "Endereço", placeholder: "Rua X, 400" },
    { key: "cep", label: "CEP", placeholder: "05435-030" },
    { key: "cidade", label: "Cidade", placeholder: "Fortaleza - CE" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <Label htmlFor={`label-${f.key}`} className="text-xs">
            {f.label}
          </Label>
          <Input
            id={`label-${f.key}`}
            value={values[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="h-9"
          />
        </div>
      ))}
      <Button size="sm" onClick={save} disabled={isPending} className="self-start">
        Salvar
      </Button>
    </div>
  );
}
