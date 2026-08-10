import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import {
  admissionProrationFactor,
  admissionUnworkedDays,
  attendanceBonusAmount,
  attendanceScore,
  attendanceStreakMultiplier,
  discountableLateMinutes,
  excessHoursByDay,
  faltaAmount,
  faltaDeductionDays,
  lateDiscountAmount,
  lateMinutes,
  nightHours,
  nightPremiumAmount,
  overtimeAmount,
  shiftHours,
  type AttendanceBonusTier,
  type AttendanceStreakTier,
} from "@/lib/payroll";

export type PaymentPreview = {
  baseSalary: number;
  proratedBaseSalary: number;
  admissionUnworkedDays: number;
  totalHours: number;
  totalNightHours: number;
  nightPremium: number;
  overtimeMode: "HORA_EXTRA" | "BANCO_HORAS";
  overtimeHours: number;
  overtimeAmount: number;
  bankedHours: number;
  lateMinutesTotal: number;
  lateDiscountMinutes: number;
  lateDiscountAmount: number;
  bonusTotal: number;
  discountTotal: number;
  advancesTotal: number;
  netAmount: number;
  bonusItems: { id: string; date: string; amount: number; description: string | null }[];
  discountItems: { id: string; date: string; amount: number; description: string | null }[];
  advanceItems: { id: string; date: string; amount: number; description: string | null }[];
  attendanceScore: number;
  lateOccurrences: number;
  absenceCount: number;
  attendanceStreakMonths: number;
  attendanceStreakMultiplier: number;
  attendanceBonusAmount: number;
  faltaDatesAuto: string[];
  faltaDaysAuto: number;
  faltaDsrDaysAuto: number;
  faltaHolidayDaysAuto: number;
  faltaAmountAuto: number;
};

export async function computePaymentPreview(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PaymentPreview> {
  // Janela estendida (6 dias pra cada lado) porque a semana de DSR de uma
  // falta perto da borda do período pode cair fora do período em si.
  const holidayWindowStart = new Date(periodStart);
  holidayWindowStart.setDate(holidayWindowStart.getDate() - 6);
  const holidayWindowEnd = new Date(periodEnd);
  holidayWindowEnd.setDate(holidayWindowEnd.getDate() + 6);

  const [employee, settings, timeEntries, adjustments, advances, dayOffs, holidays] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    getAppSettings(),
    prisma.timeEntry.findMany({
      where: { employeeId, date: { gte: periodStart, lte: periodEnd }, clockOut: { not: null } },
    }),
    prisma.payrollAdjustment.findMany({
      where: { employeeId, date: { gte: periodStart, lte: periodEnd }, paymentId: null },
      orderBy: { date: "asc" },
    }),
    prisma.advance.findMany({
      where: { employeeId, date: { gte: periodStart, lte: periodEnd }, paymentId: null },
      orderBy: { date: "asc" },
    }),
    prisma.dayOff.findMany({
      where: { employeeId, date: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: holidayWindowStart, lte: holidayWindowEnd } },
      select: { date: true },
    }),
  ]);

  const previousPayment = await prisma.payment.findFirst({
    where: { employeeId, periodEnd: { lt: periodStart } },
    orderBy: { periodEnd: "desc" },
  });
  const priorStreakMonths = previousPayment?.attendanceStreakMonths ?? 0;

  const baseSalary = Number(employee.baseSalary);
  // Salário proporcional se o funcionário foi admitido no meio do mês que está
  // sendo pago (senão receberia o mês cheio sem ter trabalhado o mês todo).
  const admissionUnworkedDaysVal = admissionUnworkedDays(employee.hireDate, periodEnd);
  const proratedBaseSalary = baseSalary * admissionProrationFactor(employee.hireDate, periodEnd);
  let totalHours = 0;
  let totalNightHours = 0;
  let lateMinutesTotal = 0;
  let lateDiscountMinutesTotal = 0;
  let lateOccurrences = 0;
  const hoursByDay = new Map<string, number>();
  for (const entry of timeEntries) {
    if (!entry.clockOut) continue;
    const hours = shiftHours(entry.clockIn, entry.clockOut);
    totalHours += hours;
    totalNightHours += nightHours(entry.clockIn, entry.clockOut);
    const dayKey = entry.date.toISOString().slice(0, 10);
    hoursByDay.set(dayKey, (hoursByDay.get(dayKey) ?? 0) + hours);

    const late = lateMinutes(employee.scheduledStart, entry.clockIn);
    lateMinutesTotal += late;
    const discountable = discountableLateMinutes(late);
    lateDiscountMinutesTotal += discountable;
    if (discountable > 0) lateOccurrences += 1;
  }
  const nightPremium = nightPremiumAmount(baseSalary, totalNightHours);
  const lateDiscountPay = lateDiscountAmount(baseSalary, lateDiscountMinutesTotal);

  const absenceCount = dayOffs.filter((d) => d.type === "ATESTADO" || d.type === "FALTA").length;

  // Desconto de falta conforme a CLT/Lei 605-49: 1/30 do salário por dia,
  // contando o dia da falta em si + o DSR (descanso semanal remunerado) da
  // semana em que ela ocorreu + qualquer feriado dentro dessa mesma semana
  // — detectado a partir das faltas já registradas no período (em
  // Funcionários → Folgas, atestados e faltas), sem precisar digitar de novo.
  const faltaDatesAuto = dayOffs
    .filter((d) => d.type === "FALTA")
    .map((d) => d.date.toISOString().slice(0, 10))
    .sort();
  const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  const faltaDeduction = faltaDeductionDays(faltaDatesAuto, employee.weeklyDayOff, holidayDates);
  const faltaDaysAuto = faltaDeduction.totalDays;
  const faltaAmountAutoVal = faltaAmount(baseSalary, faltaDaysAuto);
  const scoreVal = attendanceScore(lateOccurrences, settings.latePenaltyPoints);
  const baseBonusVal = attendanceBonusAmount(
    scoreVal,
    absenceCount > 0,
    settings.attendanceBonusTiers as unknown as AttendanceBonusTier[],
  );

  // A sequência já conta este período se ele vier limpo (sem falta/atestado)
  // — ao bater a faixa (ex: 3º mês seguido), o bônus deste mesmo mês já
  // multiplica, em vez de só valer a partir do mês seguinte.
  const streakMonths = absenceCount > 0 ? 0 : priorStreakMonths + 1;
  const streakMultiplier = attendanceStreakMultiplier(
    streakMonths,
    settings.attendanceStreakTiers as unknown as AttendanceStreakTier[],
  );
  const attendanceBonusVal = baseBonusVal * streakMultiplier;

  const dailyExpectedHours = Number(settings.dailyExpectedHours);
  const excessHours = excessHoursByDay(hoursByDay, dailyExpectedHours);
  const overtimeHours = settings.overtimeMode === "HORA_EXTRA" ? excessHours : 0;
  const bankedHours = settings.overtimeMode === "BANCO_HORAS" ? excessHours : 0;
  const overtimePay =
    overtimeHours > 0 ? overtimeAmount(baseSalary, overtimeHours, Number(settings.overtimeRate)) : 0;

  const bonusItems = adjustments
    .filter((a) => a.type === "BONUS")
    .map((a) => ({
      id: a.id,
      date: a.date.toISOString().slice(0, 10),
      amount: Number(a.amount),
      description: a.description,
    }));
  const discountItems = adjustments
    .filter((a) => a.type === "DESCONTO")
    .map((a) => ({
      id: a.id,
      date: a.date.toISOString().slice(0, 10),
      amount: Number(a.amount),
      description: a.description,
    }));
  const advanceItems = advances.map((a) => ({
    id: a.id,
    date: a.date.toISOString().slice(0, 10),
    amount: Number(a.amount),
    description: a.description,
  }));

  const bonusTotal = bonusItems.reduce((sum, i) => sum + i.amount, 0);
  const discountTotal = discountItems.reduce((sum, i) => sum + i.amount, 0);
  const advancesTotal = advanceItems.reduce((sum, i) => sum + i.amount, 0);
  const netAmount =
    proratedBaseSalary +
    nightPremium +
    overtimePay +
    bonusTotal -
    discountTotal -
    advancesTotal -
    lateDiscountPay;

  return {
    baseSalary,
    proratedBaseSalary,
    admissionUnworkedDays: admissionUnworkedDaysVal,
    totalHours,
    totalNightHours,
    nightPremium,
    overtimeMode: settings.overtimeMode,
    overtimeHours,
    overtimeAmount: overtimePay,
    bankedHours,
    lateMinutesTotal,
    lateDiscountMinutes: lateDiscountMinutesTotal,
    lateDiscountAmount: lateDiscountPay,
    bonusTotal,
    discountTotal,
    advancesTotal,
    netAmount,
    bonusItems,
    discountItems,
    advanceItems,
    attendanceScore: scoreVal,
    lateOccurrences,
    absenceCount,
    attendanceStreakMonths: streakMonths,
    attendanceStreakMultiplier: streakMultiplier,
    attendanceBonusAmount: attendanceBonusVal,
    faltaDatesAuto,
    faltaDaysAuto,
    faltaDsrDaysAuto: faltaDeduction.dsrDaysLost,
    faltaHolidayDaysAuto: faltaDeduction.holidayDaysLost,
    faltaAmountAuto: faltaAmountAutoVal,
  };
}
