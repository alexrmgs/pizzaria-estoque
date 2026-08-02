import { todayInBrazil } from "@/lib/payroll";

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
 * registrada (`avulsaDates`, no formato YYYY-MM-DD), exceto datas em
 * `workOverrideDates` — dias marcados como "Trabalha" (folga comprada ou
 * remanejada), que cancelam a folga só naquele dia. `from` é normalizado
 * pra "hoje em Brasília" via {@link todayInBrazil} e a janela é toda
 * construída com `Date.UTC`, independente do fuso do processo Node (ver
 * comentário em `todayInBrazil`).
 */
export function upcomingFolgas(
  weeklyDayOff: number | null,
  avulsaDates: Set<string>,
  daysAhead: number,
  from: Date = new Date(),
  workOverrideDates: Set<string> = new Set(),
): FolgaDate[] {
  const result: FolgaDate[] = [];
  const start = todayInBrazil(from);
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i),
    );
    const iso = d.toISOString().slice(0, 10);
    if (workOverrideDates.has(iso)) continue;
    const isWeekly = weeklyDayOff !== null && d.getUTCDay() === weeklyDayOff;
    const isAvulsa = avulsaDates.has(iso);
    if (isWeekly || isAvulsa) {
      result.push({ date: iso, source: isAvulsa ? "avulsa" : "semanal" });
    }
  }
  return result;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export type SwapRequest = {
  id: string;
  requesterDate: string;
  targetDate: string;
  status: string;
  note: string | null;
  createdAt: string;
  requesterName?: string;
  targetName?: string;
};

export const STATUS_LABELS: Record<
  string,
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  PENDENTE: { label: "Aguardando colega", variant: "outline" },
  ACEITO_PELO_FUNCIONARIO: { label: "Aguardando gerência", variant: "outline" },
  RECUSADO_PELO_FUNCIONARIO: { label: "Recusado pelo colega", variant: "destructive" },
  APROVADO: { label: "Aprovado", variant: "secondary" },
  RECUSADO_PELA_GERENCIA: { label: "Recusado pela gerência", variant: "destructive" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};
