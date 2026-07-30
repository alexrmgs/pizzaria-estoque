// Adiantamento quinzenal pago todo dia 20, como % do salário bruto (fixo).
export const SALARY_ADVANCE_RATE = 0.4;
export const SALARY_ADVANCE_TAG = "Adiantamento quinzenal (40%)";

// Brazilian CLT minimum night-shift premium (adicional noturno) for urban workers: 20%.
export const NIGHT_PREMIUM_RATE = 0.2;
// Standard hours-per-month divisor used to derive an hourly rate from a fixed monthly salary.
export const MONTHLY_HOURS = 220;
// Night shift window: 22:00 to 05:00.
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;

export function shiftHours(clockIn: Date, clockOut: Date): number {
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000);
}

/**
 * Formata horas decimais (ex: 8.4667) como "8h28min" — evita confundir com
 * horas:minutos (ex: "8.47" lido como "8:47" em vez de 8h28).
 */
export function formatShiftDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}min`;
}

export function nightHours(clockIn: Date, clockOut: Date): number {
  if (clockOut <= clockIn) return 0;

  let totalMs = 0;
  // Start one day early so the tail of the previous night's window (which can
  // run into the early hours of clockIn's day, e.g. 00:00-05:00) is checked too.
  const cursor = new Date(clockIn);
  cursor.setDate(cursor.getDate() - 1);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < clockOut.getTime()) {
    const nightStart = new Date(cursor);
    nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0);
    const nightEnd = new Date(cursor);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(NIGHT_END_HOUR, 0, 0, 0);

    const overlapStart = Math.max(clockIn.getTime(), nightStart.getTime());
    const overlapEnd = Math.min(clockOut.getTime(), nightEnd.getTime());
    if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart;

    cursor.setDate(cursor.getDate() + 1);
  }

  return totalMs / 3_600_000;
}

export function hourlyRate(baseSalary: number): number {
  return baseSalary / MONTHLY_HOURS;
}

export function nightPremiumAmount(baseSalary: number, totalNightHours: number): number {
  return hourlyRate(baseSalary) * NIGHT_PREMIUM_RATE * totalNightHours;
}

/**
 * Sums, per calendar day, how much a day's worked hours exceed the expected
 * daily journey. Overtime in Brazil is calculated per day, not netted across
 * a period, so a short day never offsets a long one.
 */
export function excessHoursByDay(
  hoursWorkedByDate: Map<string, number>,
  dailyExpectedHours: number,
): number {
  let excess = 0;
  for (const hours of hoursWorkedByDate.values()) {
    excess += Math.max(0, hours - dailyExpectedHours);
  }
  return excess;
}

export function overtimeAmount(
  baseSalary: number,
  overtimeHours: number,
  overtimeRate: number,
): number {
  return hourlyRate(baseSalary) * overtimeRate * overtimeHours;
}

/**
 * Minutes late relative to the employee's scheduled start time ("HH:MM"),
 * comparing against the scheduled time on clockIn's own calendar day.
 * Returns 0 if there's no schedule set, or if clockIn is on time/early.
 */
export function lateMinutes(scheduledStart: string | null | undefined, clockIn: Date): number {
  if (!scheduledStart) return 0;
  const [hour, minute] = scheduledStart.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;

  const scheduled = new Date(clockIn);
  scheduled.setHours(hour, minute, 0, 0);

  const diffMinutes = Math.round((clockIn.getTime() - scheduled.getTime()) / 60_000);
  return diffMinutes > 0 ? diffMinutes : 0;
}

/**
 * Quantos minutos faltam pro horário de entrada agendado (0 se já chegou a
 * hora ou passou, ou se não tem horário cadastrado). Usado pra bloquear
 * quem tenta bater entrada cedo demais.
 */
export function minutesBeforeScheduledStart(
  scheduledStart: string | null | undefined,
  now: Date,
): number {
  if (!scheduledStart) return 0;
  const [hour, minute] = scheduledStart.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;

  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);

  const diffMinutes = Math.round((scheduled.getTime() - now.getTime()) / 60_000);
  return diffMinutes > 0 ? diffMinutes : 0;
}

export const EARLY_CLOCK_IN_TOLERANCE_MINUTES = 10;

// CLT Art. 58 §1º: variações de até 5 minutos no ponto não são descontadas
// nem computadas. Acima disso, o atraso inteiro passa a ser descontável
// (a tolerância é um limite, não um abatimento parcial).
export const LATE_TOLERANCE_MINUTES = 5;

export function discountableLateMinutes(lateMinutesForDay: number): number {
  return lateMinutesForDay > LATE_TOLERANCE_MINUTES ? lateMinutesForDay : 0;
}

export function lateDiscountAmount(baseSalary: number, discountableMinutesTotal: number): number {
  return hourlyRate(baseSalary) * (discountableMinutesTotal / 60);
}

// ---------- Descontos opcionais de carteira assinada (aplicados só se marcados no fechamento) ----------

export type TaxBracket = { upTo: number | null; rate: number };

/**
 * Imposto progressivo por faixa: cada faixa é taxada só na parte da base que
 * cai dentro dela (não a base inteira pela alíquota da faixa mais alta).
 * `upTo: null` marca a última faixa como sem teto.
 */
export function progressiveTax(base: number, brackets: TaxBracket[]): number {
  if (base <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.upTo ?? Infinity;
    if (base <= lower) break;
    const taxableInBracket = Math.min(base, upper) - lower;
    if (taxableInBracket > 0) tax += taxableInBracket * bracket.rate;
    lower = upper;
  }
  return tax;
}

/**
 * INSS: progressivo com teto (a última faixa tem upTo definido — o valor
 * acima disso não é mais descontado). As alíquotas/faixas mudam todo ano,
 * por isso ficam configuráveis em Configurações.
 */
export function inssAmount(grossForInss: number, brackets: TaxBracket[]): number {
  const cap = brackets.length > 0 ? brackets[brackets.length - 1].upTo : null;
  const base = cap !== null ? Math.min(grossForInss, cap) : grossForInss;
  return progressiveTax(base, brackets);
}

/**
 * IRRF: progressivo sem teto, incidindo sobre (bruto - INSS - dedução por
 * dependente). A última faixa deve ter upTo: null.
 */
export function irrfAmount(
  grossForIrrf: number,
  inssDeducted: number,
  dependents: number,
  dependentDeduction: number,
  brackets: TaxBracket[],
): number {
  const base = grossForIrrf - inssDeducted - dependents * dependentDeduction;
  return progressiveTax(base, brackets);
}

export function faltaAmount(baseSalary: number, faltaDays: number): number {
  return (baseSalary / 30) * faltaDays;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type FaltaDeduction = {
  totalDays: number;
  faltaDays: number;
  dsrDaysLost: number;
  holidayDaysLost: number;
};

/**
 * Dias a descontar por falta injustificada, seguindo a Lei 605/49 (art. 6º):
 * além do dia da falta em si, o funcionário perde o direito ao DSR
 * (descanso semanal remunerado) da semana em que faltou, e a qualquer
 * feriado que caia dentro dessa mesma semana — a falta quebra a
 * "assiduidade integral" exigida pra receber esses dias como remunerados.
 *
 * A "semana" de cada falta é definida pela folga fixa semanal do
 * funcionário (`weeklyDayOff`): os 7 dias terminando nessa folga. Faltas
 * na mesma semana só derrubam 1 DSR (não um por falta) — é um só descanso
 * por semana, não importa quantas faltas ocorreram nela.
 *
 * Sem folga fixa cadastrada não dá pra determinar a semana, então só os
 * dias da falta em si são descontados (sem DSR/feriado).
 */
export function faltaDeductionDays(
  faltaDates: string[],
  weeklyDayOff: number | null,
  holidayDates: Set<string>,
): FaltaDeduction {
  if (weeklyDayOff === null) {
    return { totalDays: faltaDates.length, faltaDays: faltaDates.length, dsrDaysLost: 0, holidayDaysLost: 0 };
  }

  const faltasByWeek = new Map<string, number>();
  for (const faltaStr of faltaDates) {
    const falta = fromISODate(faltaStr);
    const offset = (weeklyDayOff - falta.getDay() + 7) % 7;
    const dsrDate = new Date(falta);
    dsrDate.setDate(dsrDate.getDate() + offset);
    const dsrKey = toISODate(dsrDate);
    faltasByWeek.set(dsrKey, (faltasByWeek.get(dsrKey) ?? 0) + 1);
  }

  let faltaDaysTotal = 0;
  let dsrDaysLost = 0;
  let holidayDaysLost = 0;

  for (const [dsrKey, count] of faltasByWeek) {
    faltaDaysTotal += count;
    dsrDaysLost += 1;

    const dsrDateObj = fromISODate(dsrKey);
    for (let i = 0; i < 7; i++) {
      const day = new Date(dsrDateObj);
      day.setDate(day.getDate() - i);
      if (holidayDates.has(toISODate(day))) holidayDaysLost += 1;
    }
  }

  return {
    totalDays: faltaDaysTotal + dsrDaysLost + holidayDaysLost,
    faltaDays: faltaDaysTotal,
    dsrDaysLost,
    holidayDaysLost,
  };
}

export function valeTransporteAmount(baseSalary: number, ratePercent: number): number {
  return baseSalary * (ratePercent / 100);
}

// ---------- Pontuação de assiduidade e pontualidade ----------

export type AttendanceBonusTier = { minScore: number; bonus: number };

/**
 * Pontuação de pontualidade do período: começa em 100 e perde pontos fixos
 * a cada dia com atraso além da tolerância (não pelo tanto de minutos).
 */
export function attendanceScore(lateOccurrences: number, latePenaltyPoints: number): number {
  return Math.max(0, 100 - lateOccurrences * latePenaltyPoints);
}

/**
 * Bônus final do período: qualquer falta ou atestado no período zera o
 * bônus, independente da pontuação de pontualidade. Sem faltas/atestados,
 * o valor vem da maior faixa de `attendanceBonusTiers` cuja `minScore` a
 * pontuação atingir (faixas não precisam estar ordenadas).
 */
export function attendanceBonusAmount(
  score: number,
  hasAbsenceOrAtestado: boolean,
  tiers: AttendanceBonusTier[],
): number {
  if (hasAbsenceOrAtestado) return 0;
  const eligible = tiers.filter((t) => score >= t.minScore);
  if (eligible.length === 0) return 0;
  return Math.max(...eligible.map((t) => t.bonus));
}

export type AttendanceStreakTier = { months: number; multiplier: number };

/**
 * Multiplicador do bônus pela sequência de meses seguidos sem falta/atestado
 * (a sequência já inclui o mês em fechamento, se ele também vier limpo — ver
 * `payment-preview.ts`). Faixas não precisam estar ordenadas; a maior
 * `months` que a sequência atingir vence.
 */
export function attendanceStreakMultiplier(
  streakMonths: number,
  tiers: AttendanceStreakTier[],
): number {
  const eligible = tiers.filter((t) => streakMonths >= t.months);
  if (eligible.length === 0) return 1;
  return Math.max(...eligible.map((t) => t.multiplier));
}

// ---------- Ciclo mensal de fechamento (vales do mês, pagamento no 5º dia útil seguinte) ----------

/**
 * Retorna a data do n-ésimo dia útil (seg-sex, sem considerar feriados) do
 * mês informado. `month` é 0-indexado (0 = janeiro), igual ao Date nativo.
 */
export function nthBusinessDayOfMonth(year: number, month: number, n: number): Date {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < n) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    if (count === n) break;
    date.setDate(date.getDate() + 1);
  }
  return date;
}

/** Início e fim (inclusive) do mês anterior ao de `reference`. */
export function previousMonthRange(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 0);
  return { start, end };
}
