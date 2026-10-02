"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ajustarDiaPonto } from "./actions";

type Situacao = "TRABALHOU" | "FALTA" | "ATESTADO" | "FOLGA" | "LIMPAR";

const OPCOES: { value: Situacao; label: string }[] = [
  { value: "TRABALHOU", label: "Trabalhou" },
  { value: "FALTA", label: "Falta" },
  { value: "ATESTADO", label: "Atestado" },
  { value: "FOLGA", label: "Folga" },
  { value: "LIMPAR", label: "Sem registro" },
];

export function AjustarDiaDialog({
  employeeId,
  employeeName,
  date,
  dateLabel,
  situacaoAtual,
  batida,
  dayOffReason,
  temMaisBatidas,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  dateLabel: string;
  situacaoAtual: string;
  batida: { id: string; entrada: string; saida: string | null; note: string | null } | null;
  dayOffReason: string | null;
  temMaisBatidas: boolean;
}) {
  const inicial: Situacao =
    situacaoAtual === "TRABALHOU" || situacaoAtual === "EM_ABERTO"
      ? "TRABALHOU"
      : situacaoAtual === "SEM_REGISTRO"
        ? "TRABALHOU"
        : (situacaoAtual as Situacao);
  const [open, setOpen] = useState(false);
  const [situacao, setSituacao] = useState<Situacao>(inicial);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    if (situacao !== "TRABALHOU" && batida && !confirm("Isso apaga o ponto batido nesse dia. Continuar?")) {
      return;
    }
    startTransition(async () => {
      const result = await ajustarDiaPonto(employeeId, batida?.id ?? null, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        toast.success("Dia ajustado.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setError(undefined);
          setSituacao(inicial);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 px-2 print:hidden">
            Editar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {employeeName} — {dateLabel}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="situacao" value={situacao} />

          <div className="flex flex-wrap gap-2">
            {OPCOES.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={situacao === o.value ? "default" : "outline"}
                onClick={() => setSituacao(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>

          {situacao === "TRABALHOU" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="aj-in">Entrada</Label>
                  <Input id="aj-in" name="clockIn" type="time" defaultValue={batida?.entrada ?? ""} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="aj-out">Saída</Label>
                  <Input id="aj-out" name="clockOut" type="time" defaultValue={batida?.saida ?? ""} />
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Horário de Brasília. Saída menor que a entrada (ex: 00:30) conta como dia seguinte.
                {temMaisBatidas && " Esse dia tem mais de uma batida — aqui edita só a primeira."}
              </p>
            </>
          )}

          {situacao !== "LIMPAR" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="aj-obs">
                {situacao === "TRABALHOU" ? "Observação" : "Motivo"} (opcional)
              </Label>
              <Input
                id="aj-obs"
                name="obs"
                defaultValue={(situacao === "TRABALHOU" ? batida?.note : dayOffReason) ?? ""}
                placeholder={situacao === "ATESTADO" ? "Ex: atestado médico 1 dia" : ""}
              />
            </div>
          )}

          {situacao !== "TRABALHOU" && batida && (
            <p className="text-xs text-amber-700">O ponto batido nesse dia será apagado.</p>
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
