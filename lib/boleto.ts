// Decodifica a linha digitável de um boleto (sem depender de API): a própria
// linha carrega o VALOR e o VENCIMENTO embutidos.
// - Boleto bancário: 47 dígitos (fator de vencimento + valor no fim).
// - Conta de consumo/arrecadação: 48 dígitos (começa com 8, valor no início,
//   vencimento normalmente não vem embutido).

export type BoletoParsed = {
  tipo: "bancario" | "arrecadacao";
  valor: number;
  vencimento: string | null; // YYYY-MM-DD
};

const MS = 86_400_000;

// Converte o "fator de vencimento" (4 dígitos) na data. Há duas bases por causa
// do rollover de 22/02/2025 (quando o fator estourou 9999 e voltou pra 1000):
// tenta as duas e escolhe a data mais plausível (perto de hoje).
function fatorParaData(fator: number): string | null {
  if (!fator) return null;
  const now = Date.now();
  const opcoes = [
    Date.UTC(1997, 9, 7) + fator * MS, // base antiga: 07/10/1997 + fator dias
    Date.UTC(2025, 1, 22) + (fator - 1000) * MS, // pós-rollover: 22/02/2025 = fator 1000
  ];
  const plausiveis = opcoes.filter((t) => t >= now - 400 * MS);
  const escolhido = (plausiveis.length ? plausiveis : opcoes).sort(
    (a, b) => Math.abs(a - now) - Math.abs(b - now),
  )[0];
  return new Date(escolhido).toISOString().slice(0, 10);
}

export function parseBoleto(input: string): BoletoParsed | { error: string } {
  const d = (input || "").replace(/\D/g, "");

  if (d.length === 47) {
    // Campo 5 = últimos 14 dígitos: fator (4) + valor (10, 2 casas decimais).
    const campo5 = d.slice(33);
    const fator = parseInt(campo5.slice(0, 4), 10);
    const valor = parseInt(campo5.slice(4), 10) / 100;
    if (!Number.isFinite(valor)) return { error: "Não consegui ler o valor do boleto." };
    return { tipo: "bancario", valor, vencimento: fatorParaData(fator) };
  }

  if (d.length === 48) {
    // Arrecadação: 4 blocos de 12 (11 + DV). Código de barras = os 11 de cada.
    const barras =
      d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47);
    const valor = parseInt(barras.slice(4, 15), 10) / 100;
    if (!Number.isFinite(valor)) return { error: "Não consegui ler o valor da conta." };
    return { tipo: "arrecadacao", valor, vencimento: null };
  }

  return { error: "Linha digitável inválida (esperado 47 ou 48 números)." };
}
