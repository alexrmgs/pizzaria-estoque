import { prisma } from "@/lib/prisma";
import { nightHours, shiftHours } from "@/lib/payroll";

// Relatório mensal de ponto pra mandar pra contabilidade: por funcionário,
// cada dia do mês com entrada/saída, horas, horas noturnas e se foi
// feriado, falta, atestado ou folga.

export type DiaPonto = {
  date: string; // aaaa-mm-dd
  weekday: number;
  batidas: { id: string; entrada: string; saida: string | null; note: string | null }[];
  horas: number;
  horasNoturnas: number;
  feriado: string | null;
  dayOffReason: string | null;
  obs: string | null; // motivo da falta/atestado/folga e observação do ponto
  situacao: "TRABALHOU" | "EM_ABERTO" | "FALTA" | "ATESTADO" | "FOLGA" | "SEM_REGISTRO";
};

export type FuncionarioPonto = {
  id: string;
  name: string;
  role: string | null;
  storeName: string | null;
  hireDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  weeklyDayOff: number | null;
  dias: DiaPonto[];
  totalHoras: number;
  totalNoturnas: number;
  diasTrabalhados: number;
  feriadosTrabalhados: string[];
  faltas: string[];
  atestados: string[];
  folgas: number;
  semRegistro: string[];
};

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WEEKDAY_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export const SITUACAO_LABEL: Record<DiaPonto["situacao"], string> = {
  TRABALHOU: "Trabalhou",
  EM_ABERTO: "Sem saída registrada",
  FALTA: "Falta",
  ATESTADO: "Atestado",
  FOLGA: "Folga",
  SEM_REGISTRO: "Sem registro",
};

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatHoras(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

export function formatDiaBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09" → primeiro e último dia do mês (meia-noite UTC, igual aos campos @db.Date). */
export function monthRange(mes: string): { start: Date; end: Date; days: string[] } {
  const [y, m] = mes.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return { start, end, days };
}

export async function buildRelatorioPonto(
  mes: string,
  employeeId?: string,
): Promise<FuncionarioPonto[]> {
  const { start, end, days } = monthRange(mes);

  const [employees, holidays] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...(employeeId ? { id: employeeId } : {}),
        // Inclui quem foi desligado no meio do mês mas ainda bateu ponto nele.
        OR: [{ active: true }, { timeEntries: { some: { date: { gte: start, lte: end } } } }],
      },
      orderBy: { name: "asc" },
      include: {
        store: { select: { name: true } },
        timeEntries: { where: { date: { gte: start, lte: end } }, orderBy: { clockIn: "asc" } },
        dayOffs: { where: { date: { gte: start, lte: end } } },
      },
    }),
    prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);

  const holidayByDate = new Map(holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name]));
  const todayISO = new Date().toISOString().slice(0, 10);

  return employees.map((employee) => {
    const hireISO = employee.hireDate?.toISOString().slice(0, 10);
    const dayOffByDate = new Map(
      employee.dayOffs.map((d) => [d.date.toISOString().slice(0, 10), d]),
    );
    const entriesByDate = new Map<string, typeof employee.timeEntries>();
    for (const entry of employee.timeEntries) {
      const key = entry.date.toISOString().slice(0, 10);
      entriesByDate.set(key, [...(entriesByDate.get(key) ?? []), entry]);
    }

    const result: FuncionarioPonto = {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      storeName: employee.store?.name ?? null,
      hireDate: hireISO ?? null,
      scheduledStart: employee.scheduledStart,
      scheduledEnd: employee.scheduledEnd,
      weeklyDayOff: employee.weeklyDayOff,
      dias: [],
      totalHoras: 0,
      totalNoturnas: 0,
      diasTrabalhados: 0,
      feriadosTrabalhados: [],
      faltas: [],
      atestados: [],
      folgas: 0,
      semRegistro: [],
    };

    for (const date of days) {
      // Antes da admissão o funcionário não existia — não conta nada.
      if (hireISO && date < hireISO) continue;

      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const entries = entriesByDate.get(date) ?? [];
      const dayOff = dayOffByDate.get(date);
      const dayOffType = dayOff?.type;
      const feriado = holidayByDate.get(date) ?? null;

      let horas = 0;
      let horasNoturnas = 0;
      for (const e of entries) {
        if (!e.clockOut) continue;
        horas += shiftHours(e.clockIn, e.clockOut);
        horasNoturnas += nightHours(e.clockIn, e.clockOut);
      }

      const isWeeklyDayOff =
        employee.weeklyDayOff !== null && weekday === employee.weeklyDayOff && dayOffType !== "TRABALHA";

      let situacao: DiaPonto["situacao"];
      if (entries.length > 0) {
        situacao = entries.every((e) => e.clockOut) ? "TRABALHOU" : "EM_ABERTO";
      } else if (dayOffType === "FALTA") {
        situacao = "FALTA";
      } else if (dayOffType === "ATESTADO") {
        situacao = "ATESTADO";
      } else if (dayOffType === "FOLGA" || isWeeklyDayOff || feriado) {
        situacao = "FOLGA";
      } else {
        situacao = "SEM_REGISTRO";
      }

      result.dias.push({
        date,
        weekday,
        batidas: entries.map((e) => ({
          id: e.id,
          entrada: TIME_FMT.format(e.clockIn),
          saida: e.clockOut ? TIME_FMT.format(e.clockOut) : null,
          note: e.note,
        })),
        horas,
        horasNoturnas,
        feriado,
        situacao,
        dayOffReason: dayOff?.reason ?? null,
        obs:
          [dayOff?.reason, ...entries.map((e) => e.note)]
            .map((t) => t?.trim())
            .filter(Boolean)
            .join(" · ") || null,
      });

      result.totalHoras += horas;
      result.totalNoturnas += horasNoturnas;
      if (entries.length > 0) result.diasTrabalhados += 1;
      if (entries.length > 0 && feriado) result.feriadosTrabalhados.push(date);
      if (situacao === "FALTA") result.faltas.push(date);
      if (situacao === "ATESTADO") result.atestados.push(date);
      if (situacao === "FOLGA") result.folgas += 1;
      // Dia futuro ainda não aconteceu — não é "sem registro".
      if (situacao === "SEM_REGISTRO" && date < todayISO) result.semRegistro.push(date);
    }

    return result;
  });
}
