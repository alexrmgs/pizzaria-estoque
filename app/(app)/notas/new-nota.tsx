"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarNotaDeXml, criarNotaManual } from "./actions";

export function NewNota() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const result = await criarNotaDeXml(text);
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não consegui ler o XML.");
        return;
      }
      toast.success("Nota importada. Confira os itens ✅");
      router.push(`/notas/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function manual() {
    setLoading(true);
    const result = await criarNotaManual();
    setLoading(false);
    if (result.error || !result.id) {
      toast.error(result.error ?? "Erro ao criar nota.");
      return;
    }
    router.push(`/notas/${result.id}`);
  }

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={onFile}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={loading} className="h-10">
        <Upload className="mr-1 size-4" /> Subir XML
      </Button>
      <Button onClick={manual} disabled={loading} variant="outline" className="h-10">
        <Pencil className="mr-1 size-4" /> Digitar
      </Button>
    </div>
  );
}
