import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import {
  discountableLateMinutes,
  excessHoursByDay,
  lateDiscountAmount,
  lateMinutes,
  nightHours,
  nightPremiumAmount,
  overtimeAmount,
  shiftHours,
} from "@/lib/payroll";

export type PaymentPreview = {
  baseSalary: number;
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
};

export async function computePaymentPreview(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PaymentPreview> {
  const [employee, settings, timeEntries, adjustments, advances] = await Promise.all([
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
  ]);

  const baseSalary = Number(employee.baseSalary);
  let totalHours = 0;
  let totalNightHours = 0;
  let lateMinutesTotal = 0;
  let lateDiscountMinutesTotal = 0;
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
    lateDiscountMinutesTotal += discountableLateMinutes(late);
  }
  const nightPremium = nightPremiumAmount(baseSalary, totalNightHours);
  const lateDiscountPay = lateDiscountAmount(baseSalary, lateDiscountMinutesTotal);

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
    baseSalary +
    nightPremium +
    overtimePay +
    bonusTotal -
    discountTotal -
    advancesTotal -
    lateDiscountPay;

  return {
    baseSalary,
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
  };
}
