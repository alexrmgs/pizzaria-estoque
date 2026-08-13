"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Pencil, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarNotaDeXml, criarNotaManual, criarNotaDaFoto } from "./actions";

// Redimensiona a foto no navegador (máx 1600px, JPEG) pra ficar leve e a IA ler
// melhor. Retorna o base64 sem o prefixo "data:...".
async function fotoParaBase64(file: File): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const max = 1600;
  const escala = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL("image/jpeg", 0.8);
  return jpeg.split(",")[1] ?? "";
}

export function NewNota() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
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

  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await fotoParaBase64(file);
      toast.info("Lendo o cupom com a IA…");
      const result = await criarNotaDaFoto({ base64, mediaType: "image/jpeg" });
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não consegui ler o cupom.");
        return;
      }
      toast.success("Cupom lido. Confira os itens ✅");
      router.push(`/notas/${result.id}`);
    } catch {
      toast.error("Não consegui processar a foto.");
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
    <div className="flex flex-wrap gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={onFile}
      />
      <input
        ref={fotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFoto}
      />
      <Button onClick={() => fotoRef.current?.click()} disabled={loading} className="h-10">
        <Camera className="mr-1 size-4" /> Foto do cupom
      </Button>
      <Button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        variant="outline"
        className="h-10"
      >
        <Upload className="mr-1 size-4" /> Subir XML
      </Button>
      <Button onClick={manual} disabled={loading} variant="outline" className="h-10">
        <Pencil className="mr-1 size-4" /> Digitar
      </Button>
    </div>
  );
}
