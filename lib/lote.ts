/** Número do lote como sai na etiqueta e na tela: 42 → "0042". */
export function formatLote(numero: number): string {
  return String(numero).padStart(4, "0");
}
