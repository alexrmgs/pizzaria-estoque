const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export { WEEKDAY_NAMES };

export type FolgaDate = { date: string; source: "semanal" | "avulsa" };

/**
 * Dias de folga de um funcionário dentro de uma janela a partir de hoje:
 * a folga fixa semanal (`weeklyDayOff`) mais qualquer folga avulsa
 * registrada (`avulsaDates`, no formato YYYY-MM-DD). Datas construídas em
 * horário local e lidas via toISOString — seguro porque o processo roda em
 * America/Sao_Paulo (UTC-3): meia-noite local nunca cruza pro dia UTC
 * anterior.
 */
export function upcomingFolgas(
  weeklyDayOff: number | null,
  avulsaDates: Set<string>,
  daysAhead: number,
  from: Date = new Date(),
): FolgaDate[] {
  const result: FolgaDate[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isWeekly = weeklyDayOff !== null && d.getDay() === weeklyDayOff;
    const isAvulsa = avulsaDates.has(iso);
    if (isWeekly || isAvulsa) {
      result.push({ date: iso, source: isAvulsa ? "avulsa" : "semanal" });
    }
  }
  return result;
}
