import { todayInBrazil } from "@/lib/payroll";

// Rodízio de folga aos domingos: cada funcionário folga 1 domingo e o ciclo
// se repete a cada CICLO_SEMANAS domingos (escala da casa: 6). A folga de
// domingo é extra — a folga fixa semanal continua normal.

export const CICLO_SEMANAS = 6;
export const RODIZIO_REASON = "Rodízio de domingo";
// Até onde o "Gerar" preenche, a partir de hoje.
export const HORIZONTE_SEMANAS = 26;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function addWeeksISO(iso: string, weeks: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + weeks * WEEK_MS).toISOString().slice(0, 10);
}

/** Domingo da semana de hoje (Brasília) ou o próximo, se hoje não for domingo. */
export function proximoDomingoISO(now: Date = new Date()) {
  const today = todayInBrazil(now);
  const diff = (7 - today.getUTCDay()) % 7;
  today.setUTCDate(today.getUTCDate() + diff);
  return today.toISOString().slice(0, 10);
}

export function domingosISO(primeiro: string, quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => addWeeksISO(primeiro, i));
}

/** Primeiro nome sem acento/maiúscula — pra casar "João" do PDF com "JOAO PATRICIO ...". */
export function primeiroNome(nome: string) {
  return (nome.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Escala base (Calendário de Folgas out–nov/2026): um domingo de folga de
// cada funcionário dentro do 1º ciclo. Daí pra frente o "Gerar" repete a
// cada CICLO_SEMANAS.
export const ESCALA_BASE: { date: string; nomes: string[] }[] = [
  { date: "2026-10-04", nomes: ["Pedro", "Joao"] },
  { date: "2026-10-11", nomes: ["Dulce", "Allyson", "Kleber"] },
  { date: "2026-10-18", nomes: ["Valdeir"] },
  { date: "2026-10-25", nomes: ["Gian"] },
  { date: "2026-11-01", nomes: ["Suzi", "Mauricio"] },
  { date: "2026-11-08", nomes: ["Rebeca", "Patricio"] },
];

// Feriados em que quem tem folga fixa nesse dia trabalha (folga
// remanejada/paga), conforme a escala.
export const FERIADOS_TRABALHADOS = ["2026-10-12", "2026-11-02"];
