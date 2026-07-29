"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDayOff, deleteDayOff } from "./actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type AbsenceType = "FOLGA" | "ATESTADO" | "FALTA";

type DayOff = {
  id: string;
  date: string;
  type: AbsenceType;
  reason: string | null;
};

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const TYPE_LABELS: Record<AbsenceType, string> = {
  FOLGA: "Folga",
  ATESTADO: "Atestado",
  FALTA: "Falta",
};

function TypeBadge({ type }: { type: AbsenceType }) {
  if (type === "FOLGA") return <Badge variant="secondary">Folga</Badge>;
  if (type === "ATESTADO") return <Badge variant="outline">Atestado</Badge>;
  return <Badge variant="destructive">Falta</Badge>;
}

export function DayOffsSection({
  employeeId,
  weeklyDayOff,
  dayOffs,
}: {
  employeeId: string;
  weeklyDayOff: number | null;
  dayOffs: DayOff[];
}) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<AbsenceType>("FOLGA");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addDayOff(employeeId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${TYPE_LABELS[type]} registrada.`);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteDayOff(employeeId, id);
      toast.success("Registro removido.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Folgas, atestados e faltas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {weeklyDayOff !== null ? (
          <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            Folga fixa semanal: <span className="font-medium">{WEEKDAY_NAMES[weeklyDayOff]}</span> —
            marcada automaticamente toda semana. Mude isso editando o cadastro do funcionário.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem folga fixa semanal cadastrada. Defina uma editando o cadastro do funcionário.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Registre aqui folgas avulsas, atestados médicos e faltas — isso evita confundir com falta
          na hora de fechar o pagamento e alimenta a pontuação de assiduidade/pontualidade do
          funcionário (atestado e falta zeram o bônus do período; folga não afeta nada).
        </p>
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="dayoff-date" className="text-xs">
              Data
            </Label>
            <Input
              id="dayoff-date"
              name="date"
              type="date"
              defaultValue={todayISO()}
              required
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Tipo</Label>
            <input type="hidden" name="type" value={type} />
            <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOLGA">Folga</SelectItem>
                <SelectItem value="ATESTADO">Atestado</SelectItem>
                <SelectItem value="FALTA">Falta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="dayoff-reason" className="text-xs">
              Motivo (opcional)
            </Label>
            <Input id="dayoff-reason" name="reason" placeholder="Ex: consulta médica" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Registrar
          </Button>
        </form>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayOffs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-neutral-500">
                    Nenhum registro ainda.
                  </TableCell>
                </TableRow>
              )}
              {dayOffs.map((dayOff) => (
                <TableRow key={dayOff.id}>
                  <TableCell>{dayOff.date}</TableCell>
                  <TableCell>
                    <TypeBadge type={dayOff.type} />
                  </TableCell>
                  <TableCell className="text-neutral-500">{dayOff.reason ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm("Excluir este registro?")) handleDelete(dayOff.id);
                      }}
                    >
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
