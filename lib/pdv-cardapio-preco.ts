// Partes do cardápio sem banco — usadas também nas telas (client).

export const TIPOS_PRODUTO = [
  { id: "PIZZA", label: "Pizza" },
  { id: "ESFIHA", label: "Esfiha" },
  { id: "BEIRUTE", label: "Beirute" },
  { id: "BEBIDA", label: "Bebida" },
  { id: "DOCE", label: "Doce" },
  { id: "ADICIONAL", label: "Adicional" },
  { id: "OUTRO", label: "Outro" },
] as const;

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function precoMontavel(regra: string, precos: number[]): number {
  if (!precos.length) return 0;
  const cents = precos.map((p) => Math.round(p * 100));
  const v = regra === "MEDIA" ? Math.round(cents.reduce((a, b) => a + b, 0) / cents.length) : Math.max(...cents);
  return v / 100;
}
