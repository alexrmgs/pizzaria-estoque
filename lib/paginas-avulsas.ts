// Telas do RH que dá pra liberar uma a uma no cargo, sem dar a permissão
// "Funcionários" inteira (ex: só o Ponto por Facial pra um tablet/totem).

export const RH_PAGINAS = [
  { href: "/funcionarios", label: "Funcionários" },
  { href: "/ponto-equipe", label: "Ponto da Equipe" },
  { href: "/relatorio-ponto", label: "Relatório de Ponto" },
  { href: "/ponto-totem", label: "Ponto por Facial" },
  { href: "/escalas", label: "Escalas" },
  { href: "/pagamentos", label: "Folha de Pagamento" },
  { href: "/cmo", label: "Custo de Mão de Obra (CMO)" },
  { href: "/vales", label: "Vales" },
  { href: "/madrugada", label: "Madrugada" },
] as const;

const VALIDAS = new Set<string>(RH_PAGINAS.map((p) => p.href));

export function sanitizePaginas(paginas: unknown[]): string[] {
  return paginas.filter((p): p is string => typeof p === "string" && VALIDAS.has(p));
}
