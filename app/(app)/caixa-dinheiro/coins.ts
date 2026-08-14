// Denominações de moeda controladas (base pra montar o fundo de caixa).
export const COINS = [
  { q: "q05", ini: "ini05", value: 0.05, label: "R$ 0,05" },
  { q: "q10", ini: "ini10", value: 0.1, label: "R$ 0,10" },
  { q: "q25", ini: "ini25", value: 0.25, label: "R$ 0,25" },
  { q: "q50", ini: "ini50", value: 0.5, label: "R$ 0,50" },
  { q: "q100", ini: "ini100", value: 1.0, label: "R$ 1,00" },
] as const;

export type CoinKey = (typeof COINS)[number]["q"];
export type CoinIniKey = (typeof COINS)[number]["ini"];
