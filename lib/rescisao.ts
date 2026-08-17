import { progressiveTax, type TaxBracket } from "@/lib/payroll";

export type TerminationReason = "SEM_JUSTA_CAUSA" | "PEDIDO_DEMISSAO" | "JUSTA_CAUSA" | "ACORDO";
export type AvisoPrevioTipo = "INDENIZADO" | "TRABALHADO" | "DISPENSADO";

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Anos completos de serviço entre duas datas (aniversários fechados) — usado
 * pro cálculo dos dias de aviso prévio (3 dias por ano completo, Lei
 * 12.506/2011), que NÃO arredonda por dias restantes como os avos de
 * férias/13º.
 */
export function fullYearsOfService(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const anniv = new Date(Date.UTC(end.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (end < anniv) years -= 1;
  return Math.max(0, years);
}

/**
 * Meses completos entre duas datas, com o mês corrente contando como
 * inteiro se sobrarem 15 dias ou mais (regra prática de avos usada em
 * férias proporcionais e 13º proporcional). `cap` limita o total (ex: 12).
 */
export function monthsRoundedUp(start: Date, end: Date, cap: number): number {
  if (end <= start) return 0;
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  months = Math.max(0, months);

  const anchor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  const leftoverDays = Math.floor((end.getTime() - anchor.getTime()) / 86_400_000);
  if (leftoverDays >= 15) months += 1;

  return Math.min(cap, months);
}

/** Lei 12.506/2011: 30 dias + 3 por ano completo de casa, teto de 90. */
export function avisoPrevioDays(yearsOfService: number): number {
  return Math.min(90, 30 + 3 * yearsOfService);
}

export type RescisaoInput = {
  baseSalary: number;
  hireDate: Date;
  dismissalDate: Date;
  reason: TerminationReason;
  avisoPrevio: AvisoPrevioTipo | null;
  /** Início do período aquisitivo de férias em curso (hireDate se nunca tirou). */
  lastVacationDate: Date;
  /** Saldo do FGTS informado manualmente (0 se não souber — a multa fica só sobre o depósito desta rescisão). */
  fgtsBalance: number;
  pendingAdvances: number;
  pendingDiscounts: number;
  pendingBonuses: number;
  /** Desconta 1 salário quando o empregado pede demissão e não cumpre o aviso — opcional, decisão do empregador. */
  applyAvisoNaoCumpridoDiscount: boolean;
  /** Desconta os vales/adiantamentos ainda em aberto do valor líquido — opcional, decisão do empregador. */
  applyPendingAdvancesDiscount: boolean;
  dependents: number;
  inssBrackets: TaxBracket[];
  irrfBrackets: TaxBracket[];
  irrfDependentDeduction: number;
};

export type RescisaoResult = {
  empregadorDispensa: boolean;
  avisoPrevioDays: number;
  projectedEndDate: Date;
  mesesFeriasProporcionais: number;
  mesesDecimoTerceiro: number;
  anosFeriasVencidas: number;
  saldoSalario: number;
  avisoIndenizadoValor: number;
  descontoAvisoNaoCumprido: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  decimoTerceiroProporcional: number;
  inssSaldoSalario: number;
  inssDecimoTerceiro: number;
  irrfSaldoSalario: number;
  irrfDecimoTerceiro: number;
  totalProventos: number;
  totalDescontos: number;
  totalLiquido: number;
  fgtsSobreVerbas: number;
  multaFgtsRate: number;
  multaFgts: number;
};

function inssAmount(base: number, brackets: TaxBracket[]): number {
  const cap = brackets.length > 0 ? brackets[brackets.length - 1].upTo : null;
  return progressiveTax(cap !== null ? Math.min(base, cap) : base, brackets);
}

function irrfAmount(
  base: number,
  inssDeducted: number,
  dependents: number,
  dependentDeduction: number,
  brackets: TaxBracket[],
): number {
  return progressiveTax(base - inssDeducted - dependents * dependentDeduction, brackets);
}

/**
 * Cálculo de rescisão CLT seguindo as regras padrão. É uma aproximação de
 * mercado (arredondamento de avos por 15 dias, IRRF do saldo/13º cada um na
 * tabela mensal simples) — pra casos fora do comum (múltiplos períodos de
 * férias vencidas, contrato de experiência, etc.) confira com o contador
 * antes de pagar.
 */
export function computeRescisao(input: RescisaoInput): RescisaoResult {
  const { baseSalary, hireDate, dismissalDate, reason, avisoPrevio, lastVacationDate } = input;

  const isJustaCausa = reason === "JUSTA_CAUSA";
  const isAcordo = reason === "ACORDO";
  const isPedidoDemissao = reason === "PEDIDO_DEMISSAO";
  const empregadorDispensa = reason === "SEM_JUSTA_CAUSA" || isAcordo;

  const years = fullYearsOfService(hireDate, dismissalDate);
  let avisoDias = empregadorDispensa ? avisoPrevioDays(years) : 0;
  const avisoIndenizadoAplicavel = empregadorDispensa && avisoPrevio === "INDENIZADO";
  if (isAcordo && avisoIndenizadoAplicavel) avisoDias = Math.ceil(avisoDias / 2);

  const projectedEndDate = avisoIndenizadoAplicavel ? addDays(dismissalDate, avisoDias) : dismissalDate;
  const avisoIndenizadoValor = avisoIndenizadoAplicavel ? (baseSalary / 30) * avisoDias : 0;
  const descontoAvisoNaoCumprido =
    isPedidoDemissao && avisoPrevio === "DISPENSADO" && input.applyAvisoNaoCumpridoDiscount
      ? baseSalary
      : 0;

  const saldoSalario = (baseSalary / 30) * dismissalDate.getUTCDate();

  // Férias vencidas: um "terço constitucional" pago por período aquisitivo de
  // 12 meses já fechado sem gozo — mantido mesmo na justa causa (é direito já
  // adquirido). O período aquisitivo em curso (parcial) vira as proporcionais.
  const anosFeriasVencidas = fullYearsOfService(lastVacationDate, dismissalDate);
  const feriasVencidas = anosFeriasVencidas > 0 ? baseSalary * anosFeriasVencidas * (4 / 3) : 0;

  const inicioPeriodoCorrente = new Date(lastVacationDate);
  inicioPeriodoCorrente.setUTCFullYear(inicioPeriodoCorrente.getUTCFullYear() + anosFeriasVencidas);
  const mesesFeriasProporcionais = monthsRoundedUp(inicioPeriodoCorrente, projectedEndDate, 12);
  const feriasProporcionais = isJustaCausa ? 0 : (baseSalary / 12) * mesesFeriasProporcionais * (4 / 3);

  const inicioAno = new Date(Date.UTC(dismissalDate.getUTCFullYear(), 0, 1));
  const inicioContagem13 = hireDate > inicioAno ? hireDate : inicioAno;
  const mesesDecimoTerceiro = monthsRoundedUp(inicioContagem13, projectedEndDate, 12);
  const decimoTerceiroProporcional = isJustaCausa ? 0 : (baseSalary / 12) * mesesDecimoTerceiro;

  const inssSaldoSalario = inssAmount(saldoSalario, input.inssBrackets);
  const inssDecimoTerceiro = inssAmount(decimoTerceiroProporcional, input.inssBrackets);
  const irrfSaldoSalario = irrfAmount(
    saldoSalario,
    inssSaldoSalario,
    input.dependents,
    input.irrfDependentDeduction,
    input.irrfBrackets,
  );
  const irrfDecimoTerceiro = irrfAmount(
    decimoTerceiroProporcional,
    inssDecimoTerceiro,
    input.dependents,
    input.irrfDependentDeduction,
    input.irrfBrackets,
  );

  const totalProventos =
    saldoSalario +
    avisoIndenizadoValor +
    feriasVencidas +
    feriasProporcionais +
    decimoTerceiroProporcional +
    input.pendingBonuses;

  const pendingAdvancesApplied = input.applyPendingAdvancesDiscount ? input.pendingAdvances : 0;

  const totalDescontos =
    inssSaldoSalario +
    inssDecimoTerceiro +
    irrfSaldoSalario +
    irrfDecimoTerceiro +
    pendingAdvancesApplied +
    input.pendingDiscounts +
    descontoAvisoNaoCumprido;

  const totalLiquido = totalProventos - totalDescontos;

  // Súmula 305/TST: a base do FGTS sobre a própria rescisão inclui o aviso
  // indenizado, além do saldo de salário e do 13º proporcional.
  const fgtsSobreVerbas = 0.08 * (saldoSalario + decimoTerceiroProporcional + avisoIndenizadoValor);
  const multaFgtsRate = isJustaCausa || isPedidoDemissao ? 0 : isAcordo ? 0.2 : 0.4;
  const multaFgts = multaFgtsRate * (input.fgtsBalance + fgtsSobreVerbas);

  return {
    empregadorDispensa,
    avisoPrevioDays: avisoDias,
    projectedEndDate,
    mesesFeriasProporcionais,
    mesesDecimoTerceiro,
    anosFeriasVencidas,
    saldoSalario,
    avisoIndenizadoValor,
    descontoAvisoNaoCumprido,
    feriasVencidas,
    feriasProporcionais,
    decimoTerceiroProporcional,
    inssSaldoSalario,
    inssDecimoTerceiro,
    irrfSaldoSalario,
    irrfDecimoTerceiro,
    totalProventos,
    totalDescontos,
    totalLiquido,
    fgtsSobreVerbas,
    multaFgtsRate,
    multaFgts,
  };
}
