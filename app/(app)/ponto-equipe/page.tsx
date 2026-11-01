import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brazilTime, formatShiftDuration, lateMinutes, todayInBrazil, workedHours } from "@/lib/payroll";
import { AVISOS_DIAS, buildAvisosPonto, linkAvisoWhatsapp } from "@/lib/ponto-avisos";
import { EditPontoDialog } from "./edit-ponto-dialog";
import { DeletePontoButton } from "./delete-ponto-button";

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const WEEKDAY_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const formatTime = brazilTime;

/** Foto tirada pela facial no momento da batida, como prova. Clica pra abrir
 * maior numa nova aba. */
function ProofPhoto({ photo, label }: { photo: string | null; label: string }) {
  if (!photo) return null;
  return (
    <a href={photo} target="_blank" rel="noreferrer" title={`Foto da ${label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={`Foto da ${label}`}
        className="h-9 w-9 rounded object-cover ring-1 ring-neutral-200"
      />
    </a>
  );
}

export default async function PontoEquipePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAccess("canManageFuncionarios", "/ponto-equipe");

  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const date = dateParam ? new Date(`${dateParam}T00:00:00Z`) : todayInBrazil();
  const dateISO = toISODate(date);

  const [employees, dayOffs, avisosEquipe] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        store: { select: { name: true } },
        timeEntries: { where: { date } },
      },
    }),
    prisma.dayOff.findMany({
      where: { date },
      select: { employeeId: true, type: true },
    }),
    buildAvisosPonto(),
  ]);
  const comAvisos = avisosEquipe.filter((f) => f.avisos.length > 0);

  const dayOffByEmployee = new Map(dayOffs.map((d) => [d.employeeId, d.type]));

  type Row = {
    employeeId: string;
    name: string;
    role: string | null;
    storeName: string | null;
    scheduledStart: string | null;
    entry: (typeof employees)[number]["timeEntries"][number] | null;
    status: "OK" | "EM_ABERTO" | "FOLGA" | "FALTA" | "ATESTADO" | "SEM_REGISTRO";
  };

  const rows: Row[] = employees.map((employee) => {
    const entry = employee.timeEntries[0] ?? null;
    const dayOffType = dayOffByEmployee.get(employee.id);
    const isWeeklyDayOff = employee.weeklyDayOff !== null && date.getUTCDay() === employee.weeklyDayOff;
    const isWorkOverride = dayOffType === "TRABALHA";
    const isFolga = !isWorkOverride && (dayOffType === "FOLGA" || isWeeklyDayOff);

    let status: Row["status"];
    if (entry) {
      status = entry.clockOut ? "OK" : "EM_ABERTO";
    } else if (dayOffType === "FALTA") {
      status = "FALTA";
    } else if (dayOffType === "ATESTADO") {
      status = "ATESTADO";
    } else if (isFolga) {
      status = "FOLGA";
    } else {
      status = "SEM_REGISTRO";
    }

    return {
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      storeName: employee.store?.name ?? null,
      scheduledStart: employee.scheduledStart,
      entry,
      status,
    };
  });

  const bateram = rows.filter((r) => r.status === "OK" || r.status === "EM_ABERTO").length;
  const emAberto = rows.filter((r) => r.status === "EM_ABERTO").length;
  const semRegistro = rows.filter((r) => r.status === "SEM_REGISTRO").length;
  const atrasos = rows.filter(
    (r) => r.entry && lateMinutes(r.scheduledStart, r.entry.clockIn) > 0,
  ).length;
  const folgaRows = rows.filter((r) => r.status === "FOLGA");

  const weekdayLabel = WEEKDAY_LONG[date.getUTCDay()];
  const dataCompleta = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Ponto da Equipe</h1>
        <p className="text-sm font-medium capitalize text-primary">{dataCompleta}</p>
        <p className="text-sm text-neutral-500">
          Entrada e saída de todos os funcionários num único dia.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/ponto-equipe?date=${toISODate(addDays(date, -1))}`} />}
        >
          ← Dia anterior
        </Button>
        <form className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="date">
            Data ({weekdayLabel})
          </label>
          <div className="flex gap-2">
            <input id="date" name="date" type="date" defaultValue={dateISO} className={selectClassName} />
            <Button type="submit" size="sm">
              Ver
            </Button>
          </div>
        </form>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`/ponto-equipe?date=${toISODate(addDays(date, 1))}`} />}
        >
          Próximo dia →
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href="/ponto-equipe" />}>
          Hoje
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Bateram ponto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {bateram}/{rows.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Turno em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{emAberto}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Sem registro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">{semRegistro}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Atrasos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{atrasos}</p>
          </CardContent>
        </Card>
      </div>

      {comAvisos.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg">⚠️ Avisos da equipe (últimos {AVISOS_DIAS} dias)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {comAvisos.map((f) => {
              const whatsapp = linkAvisoWhatsapp(f);
              return (
                <div key={f.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{f.name}</p>
                    <ul className="text-sm text-neutral-700">
                      {f.avisos.map((a, i) => (
                        <li key={i}>• {a.texto}</li>
                      ))}
                    </ul>
                  </div>
                  {whatsapp ? (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={whatsapp} target="_blank" rel="noreferrer" />}
                    >
                      Avisar no WhatsApp
                    </Button>
                  ) : (
                    <span className="text-xs text-neutral-500">Sem telefone no cadastro</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">De folga hoje ({folgaRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {folgaRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Ninguém de folga hoje.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {folgaRows.map((r) => (
                <Badge key={r.employeeId} variant="outline" className="text-sm">
                  {r.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registros do dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-neutral-500">
                      Nenhum funcionário ativo cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const late = r.entry ? lateMinutes(r.scheduledStart, r.entry.clockIn) : 0;
                  return (
                    <TableRow key={r.employeeId}>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.role && <span className="text-neutral-500"> · {r.role}</span>}
                      </TableCell>
                      <TableCell className="text-neutral-500">{r.storeName ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{r.entry ? formatTime(r.entry.clockIn) : "—"}</span>
                          <ProofPhoto photo={r.entry?.clockInPhoto ?? null} label="entrada" />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-neutral-500">
                        {r.entry?.breakStart
                          ? `${formatTime(r.entry.breakStart)}–${r.entry.breakEnd ? formatTime(r.entry.breakEnd) : "?"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{r.entry?.clockOut ? formatTime(r.entry.clockOut) : "—"}</span>
                          <ProofPhoto photo={r.entry?.clockOutPhoto ?? null} label="saída" />
                        </div>
                      </TableCell>
                      <TableCell className="text-neutral-500">
                        {r.entry?.clockOut
                          ? formatShiftDuration(workedHours(r.entry))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {late > 0 ? <Badge variant="destructive">{late} min</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {r.status === "OK" && <Badge variant="secondary">Completo</Badge>}
                        {r.status === "EM_ABERTO" && (
                          <Badge className="bg-primary/15 text-primary">Em aberto</Badge>
                        )}
                        {r.status === "FOLGA" && <Badge variant="outline">Folga</Badge>}
                        {r.status === "FALTA" && <Badge variant="destructive">Falta</Badge>}
                        {r.status === "ATESTADO" && <Badge variant="outline">Atestado</Badge>}
                        {r.status === "SEM_REGISTRO" && (
                          <Badge variant="destructive">Não bateu ponto</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditPontoDialog
                            employeeId={r.employeeId}
                            employeeName={r.name}
                            dateISO={dateISO}
                            entry={
                              r.entry
                                ? {
                                    id: r.entry.id,
                                    clockIn: formatTime(r.entry.clockIn),
                                    clockOut: r.entry.clockOut ? formatTime(r.entry.clockOut) : null,
                                    breakStart: r.entry.breakStart ? formatTime(r.entry.breakStart) : null,
                                    breakEnd: r.entry.breakEnd ? formatTime(r.entry.breakEnd) : null,
                                    note: r.entry.note,
                                  }
                                : null
                            }
                          />
                          {r.entry && <DeletePontoButton employeeId={r.employeeId} id={r.entry.id} />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
