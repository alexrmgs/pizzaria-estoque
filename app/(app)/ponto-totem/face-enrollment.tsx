"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCamera } from "./use-camera";
import { detectDescriptor, loadFaceApi } from "@/lib/face-recognition";
import { saveFaceDescriptor, removeFaceDescriptor } from "./actions";

type Employee = { id: string; name: string; hasFace: boolean };

export function FaceEnrollment({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const { videoRef, ready, error } = useCamera();
  const [selectedId, setSelectedId] = useState("");
  const [isPending, startTransition] = useTransition();

  function capture() {
    if (!selectedId) {
      toast.error("Escolha o funcionário primeiro.");
      return;
    }
    if (!videoRef.current) return;
    startTransition(async () => {
      try {
        await loadFaceApi();
        const descriptor = await detectDescriptor(videoRef.current!);
        if (!descriptor) {
          toast.error("Não achei um rosto. Chegue mais perto e tente de novo.");
          return;
        }
        const result = await saveFaceDescriptor(selectedId, descriptor);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Rosto cadastrado!");
        router.refresh();
      } catch {
        toast.error("Erro ao ler o rosto. Tente de novo.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeFaceDescriptor(id);
      toast.success("Rosto removido.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-md overflow-hidden rounded-xl border bg-black">
          <video ref={videoRef} className="aspect-[3/4] w-full scale-x-[-1] object-cover" muted playsInline />
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex w-full max-w-md flex-col gap-2">
          <Label htmlFor="employee" className="text-xs">
            Funcionário
          </Label>
          <Select
            name="employee"
            value={selectedId}
            onValueChange={(v) => v && setSelectedId(v)}
            items={employees.map((e) => ({ value: e.id, label: e.name }))}
          >
            <SelectTrigger id="employee" className="h-10">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {e.hasFace ? " ✅" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={capture} disabled={isPending || !ready}>
            {isPending ? "Lendo rosto…" : "📸 Capturar rosto"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
          Rostos cadastrados
        </div>
        <ul className="divide-y">
          {employees.filter((e) => e.hasFace).length === 0 && (
            <li className="p-3 text-sm text-neutral-500">Nenhum rosto cadastrado ainda.</li>
          )}
          {employees
            .filter((e) => e.hasFace)
            .map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3">
                <span className="text-sm font-medium">{e.name}</span>
                <Button variant="ghost" size="sm" disabled={isPending} onClick={() => remove(e.id)}>
                  Remover
                </Button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
