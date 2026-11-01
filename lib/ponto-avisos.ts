import { prisma } from "@/lib/prisma";
import {
  brazilDateTime,
  brazilTime,
  INTERVALO_JORNADA_HORAS,
  INTERVALO_MINIMO_MINUTOS,
  LATE_TOLERANCE_MINUTES,
  lateMinutes,
  SUSPEITA_SEM_ENTRADA_MINUTOS,
  todayInBrazil,
  TURNO_MAX_HORAS,
  turnoEsquecido,
  workedHours,
} from "@/lib/payroll";

export const AVISOS_DIAS = 7;
// Folga depois do horário antes de avisar que faltou bater.
const MARGEM_MINUTOS = 30;
// Antes disso ninguém tinha como bater intervalo.
const INTERVALO_DESDE = "2026-11-02";

const HORA_MS = 60 * 60 * 1000;

export type AvisoPonto = {
  tipo:
    | "SEM_SAIDA"
    | "SEM_ENTRADA"
    | "SEM_REGISTRO"
    | "ATRASO"
    | "TURNO_LONGO"
    | "PONTO_NA_FOLGA"
    | "INTERVALO";
  date: string;
  texto: string;
};

export type AvisosFuncionario = {
  id: string;
  name: string;
  phone: string | null;
  avisos: AvisoPonto[];
};

const diaBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Avisos dos últimos dias: o que o funcionário esqueceu ou fez fora do horário. */
export async function buildAvisosPonto(
  employeeId?: string,
  now: Date = new Date(),
): Promise<AvisosFuncionario[]> {
  const hoje = todayInBrazil(now);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const inicio = new Date(hoje.getTime() - AVISOS_DIAS * 24 * HORA_MS);

  const [employees, dayOffs] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true, ...(employeeId ? { id: employeeId } : {}) },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        hireDate: true,
        scheduledStart: true,
        scheduledEnd: true,
        weeklyDayOff: true,
        timeEntries: { where: { date: { gte: inicio } }, orderBy: { clockIn: "asc" } },
      },
    }),
    prisma.dayOff.findMany({
      where: { date: { gte: inicio }, ...(employeeId ? { employeeId } : {}) },
      select: { employeeId: true, date: true, type: true },
    }),
  ]);

  const tipoDoDia = new Map(
    dayOffs.map((d) => [`${d.employeeId}|${d.date.toISOString().slice(0, 10)}`, d.type]),
  );

  return employees.map((e) => {
    const avisos: AvisoPonto[] = [];

    for (let t = inicio.getTime(); t <= hoje.getTime(); t += 24 * HORA_MS) {
      const dia = new Date(t);
      const iso = dia.toISOString().slice(0, 10);
      if (e.hireDate && dia < e.hireDate) continue;

      const tipo = tipoDoDia.get(`${e.id}|${iso}`);
      const folgaFixa = e.weeklyDayOff !== null && dia.getUTCDay() === e.weeklyDayOff;
      const deFolga = tipo === "FOLGA" || (folgaFixa && tipo !== "TRABALHA");
      const entradas = e.timeEntries.filter((x) => x.date.toISOString().slice(0, 10) === iso);

      if (entradas.length === 0) {
        if (deFolga || tipo === "FALTA" || tipo === "ATESTADO") continue;
        if (iso < hojeISO) {
          avisos.push({ tipo: "SEM_REGISTRO", date: iso, texto: `${diaBR(iso)}: sem nenhum ponto batido` });
        } else if (
          e.scheduledStart &&
          now.getTime() >
            brazilDateTime(iso, e.scheduledStart).getTime() + MARGEM_MINUTOS * 60_000
        ) {
          avisos.push({
            tipo: "SEM_ENTRADA",
            date: iso,
            texto: `Hoje: ainda sem entrada (horário ${e.scheduledStart})`,
          });
        }
        continue;
      }

      for (const x of entradas) {
        const entrada = brazilTime(x.clockIn);
        if (deFolga) {
          avisos.push({
            tipo: "PONTO_NA_FOLGA",
            date: iso,
            texto: `${diaBR(iso)}: bateu ponto (${entrada}) em dia de folga`,
          });
        }

        const late = lateMinutes(e.scheduledStart, x.clockIn);
        if (late > SUSPEITA_SEM_ENTRADA_MINUTOS) {
          avisos.push({
            tipo: "SEM_ENTRADA",
            date: iso,
            texto: `${diaBR(iso)}: entrada só às ${entrada} (horário ${e.scheduledStart}) — pode ter esquecido a entrada`,
          });
        } else if (late > LATE_TOLERANCE_MINUTES) {
          avisos.push({
            tipo: "ATRASO",
            date: iso,
            texto: `${diaBR(iso)}: atraso de ${late} min (entrada ${entrada}, horário ${e.scheduledStart})`,
          });
        }

        if (x.clockOut) {
          const horas = (x.clockOut.getTime() - x.clockIn.getTime()) / HORA_MS;
          if (horas > TURNO_MAX_HORAS) {
            avisos.push({
              tipo: "TURNO_LONGO",
              date: iso,
              texto: `${diaBR(iso)}: turno de ${Math.round(horas)}h — provável saída esquecida`,
            });
          } else if (iso >= INTERVALO_DESDE && workedHours(x) > INTERVALO_JORNADA_HORAS) {
            const minutos =
              x.breakStart && x.breakEnd
                ? Math.round((x.breakEnd.getTime() - x.breakStart.getTime()) / 60_000)
                : null;
            if (minutos === null) {
              avisos.push({ tipo: "INTERVALO", date: iso, texto: `${diaBR(iso)}: sem intervalo batido` });
            } else if (minutos < INTERVALO_MINIMO_MINUTOS) {
              avisos.push({
                tipo: "INTERVALO",
                date: iso,
                texto: `${diaBR(iso)}: intervalo de só ${minutos} min (mínimo ${INTERVALO_MINIMO_MINUTOS})`,
              });
            }
          }
          continue;
        }

        let limite = x.clockIn.getTime() + TURNO_MAX_HORAS * HORA_MS;
        if (e.scheduledEnd) {
          let fim = brazilDateTime(iso, e.scheduledEnd).getTime();
          if (fim <= x.clockIn.getTime()) fim += 24 * HORA_MS;
          limite = Math.min(limite, fim + MARGEM_MINUTOS * 60_000);
        }
        if (now.getTime() > limite) {
          avisos.push({
            tipo: "SEM_SAIDA",
            date: iso,
            texto: `${diaBR(iso)}: sem saída (entrada ${entrada})${turnoEsquecido(x.clockIn, now) ? "" : " — ainda dá pra bater"}`,
          });
        }
      }
    }

    return { id: e.id, name: e.name, phone: e.phone, avisos: avisos.reverse() };
  });
}

/** Link do WhatsApp com a mensagem pronta (envia do WhatsApp de quem clicou). */
export function linkAvisoWhatsapp(f: AvisosFuncionario) {
  const digitos = f.phone?.replace(/\D/g, "") ?? "";
  if (digitos.length < 10) return null;
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos;
  const texto = [
    `Oi, ${f.name.split(" ")[0]}! Aviso sobre o seu ponto:`,
    ...f.avisos.map((a) => `• ${a.texto}`),
    "",
    "Por favor, fale com a gerência pra corrigir.",
  ].join("\n");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
