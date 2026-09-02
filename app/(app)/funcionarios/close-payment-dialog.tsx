"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { getPaymentPreview, closePayment, reopenPayment } from "./[id]/actions";
import type { PaymentPreview } from "@/lib/payment-preview";
import {
  faltaAmount,
  inssAmount,
  irrfAmount,
  nthBusinessDayOfMonth,
  previousMonthRange,
  valeTransporteAmount,
} from "@/lib/payroll";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Fecha por padrão o mês passado inteiro (dia 1 ao último dia) — os vales e
// horas do mês fechado são pagos no 5º dia útil do mês seguinte, então
// quando o admin abre "Fechar pagamento" ele quase sempre está fechando o
// ciclo anterior, não o mês corrente ainda em andamento.
function defaultPeriod() {
  const { start, end } = previousMonthRange(new Date());
  return { periodStart: toISO(start), periodEnd: toISO(end) };
}

type Bracket = { upTo: number | null; rate: number };
export type CltSettings = {
  inssBrackets: Bracket[];
  irrfBrackets: Bracket[];
  irrfDependentDeduction: number;
  valeTransporteRate: number;
};

export function ClosePaymentDialog({
  employeeId,
  employeeName,
  baseSalary,
  dependents,
  cltSettings,
  onClosed,
  editingPayment,
}: {
  employeeId: string;
  employeeName?: string;
  baseSalary: number;
  dependents: number;
  cltSettings: CltSettings;
  onClosed?: () => void;
  /** Presente = "Editar": reabre esse pagamento (como o botão Reabrir já faz)
   * assim que o diálogo abre, e já carrega o cálculo pro período dele, em
   * vez de partir do zero com o mês passado. */
  editingPayment?: { id: string; periodStart: string; periodEnd: string };
}) {
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(
    () => editingPayment?.periodStart ?? defaultPeriod().periodStart,
  );
  const [periodEnd, setPeriodEnd] = useState(
    () => editingPayment?.periodEnd ?? defaultPeriod().periodEnd,
  );
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [salaryOverride, setSalaryOverride] = useState(baseSalary.toFixed(2));
  const [error, setError] = useState<string | undefined>();
  const [reopening, setReopening] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [applyInss, setApplyInss] = useState(false);
  const [applyIrrf, setApplyIrrf] = useState(false);
  const [applyVt, setApplyVt] = useState(false);
  const [applyFalta, setApplyFalta] = useState(false);
  const [faltaDays, setFaltaDays] = useState("0");
  const [applyAttendanceBonus, setApplyAttendanceBonus] = useState(false);
  const [jaPago, setJaPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<"DINHEIRO" | "PIX">("PIX");
  const [dataPagamento, setDataPagamento] = useState("");

  function loadPreview(start = periodStart, end = periodEnd) {
    startTransition(async () => {
      const result = await getPaymentPreview(employeeId, start, end);
      if ("error" in result) {
        setError(result.error);
        setPreview(null);
      } else {
        setError(undefined);
        setPreview(result);
        // Já vem proporcional se admitido no meio do mês (senão é o cheio).
        setSalaryOverride(result.proratedBaseSalary.toFixed(2));
        setApplyAttendanceBonus(result.attendanceBonusAmount > 0);
        setApplyFalta(result.faltaDaysAuto > 0);
        setFaltaDays(String(result.faltaDaysAuto));
      }
    });
  }

  async function reopenThenLoad() {
    if (!editingPayment) return;
    setReopening(true);
    try {
      await reopenPayment(employeeId, editingPayment.id);
      loadPreview(editingPayment.periodStart, editingPayment.periodEnd);
    } catch {
      setError("Não foi possível reabrir esse pagamento pra editar. Tente de novo.");
    } finally {
      setReopening(false);
    }
  }

  function handleConfirm(formData: FormData) {
    startTransition(async () => {
      const result = await closePayment(employeeId, undefined, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Pagamento fechado.");
        setOpen(false);
        setPreview(null);
        onClosed?.();
      }
    });
  }

  const salaryNum = Number(salaryOverride || 0);
  const faltaVal = applyFalta ? faltaAmount(salaryNum, Number(faltaDays || 0)) : 0;
  const grossForTax = preview
    ? salaryNum + preview.nightPremium + preview.overtimeAmount
    : salaryNum;
  const inssVal = useMemo(
    () => (applyInss ? inssAmount(grossForTax, cltSettings.inssBrackets) : 0),
    [applyInss, grossForTax, cltSettings.inssBrackets],
  );
  const irrfVal = useMemo(
    () =>
      applyIrrf
        ? irrfAmount(
            grossForTax,
            inssVal,
            dependents,
            cltSettings.irrfDependentDeduction,
            cltSettings.irrfBrackets,
          )
        : 0,
    [applyIrrf, grossForTax, inssVal, dependents, cltSettings],
  );
  const vtVal = applyVt ? valeTransporteAmount(salaryNum, cltSettings.valeTransporteRate) : 0;

  const adiantamentoTotal =
    preview?.advanceItems
      .filter((item) => item.kind === "ADIANTAMENTO")
      .reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const outrosValesTotal = (preview?.advancesTotal ?? 0) - adiantamentoTotal;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPreview(null);
          setError(undefined);
          setApplyInss(false);
          setApplyIrrf(false);
          setApplyVt(false);
          setApplyFalta(false);
          setFaltaDays("0");
          setApplyAttendanceBonus(false);
          setJaPago(false);
          setFormaPagamento("PIX");
          setDataPagamento("");
          if (editingPayment) reopenThenLoad();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant={editingPayment ? "outline" : "default"}>
            {editingPayment ? "Editar" : "Fechar pagamento"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingPayment ? "Editar pagamento" : "Fechar pagamento"}
            {employeeName ? ` — ${employeeName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {editingPayment && (
            <p className="text-xs text-muted-foreground">
              Reabrindo e recalculando esse pagamento — os vales/bônus/descontos vinculados a ele
              voltam a pendente até você confirmar de novo.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="periodStart" className="text-xs">
                De
              </Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="periodEnd" className="text-xs">
                Até
              </Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => loadPreview()}
              disabled={isPending || reopening}
            >
              {reopening ? "Reabrindo..." : "Calcular"}
            </Button>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Por padrão fecha o mês passado inteiro (os vales do mês somam até o último dia e são
            pagos no 5º dia útil seguinte — este mês, até{" "}
            {(() => {
              const now = new Date();
              return nthBusinessDayOfMonth(now.getFullYear(), now.getMonth(), 5).toLocaleDateString(
                "pt-BR",
              );
            })()}
            ).
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <form action={handleConfirm} className="flex flex-col gap-4">
              <input type="hidden" name="periodStart" value={periodStart} />
              <input type="hidden" name="periodEnd" value={periodEnd} />
              <input type="hidden" name="applyInss" value={applyInss ? "on" : ""} />
              <input type="hidden" name="applyIrrf" value={applyIrrf ? "on" : ""} />
              <input type="hidden" name="applyVt" value={applyVt ? "on" : ""} />
              <input type="hidden" name="faltaDays" value={applyFalta ? faltaDays : "0"} />
              <input
                type="hidden"
                name="applyAttendanceBonus"
                value={applyAttendanceBonus ? "on" : ""}
              />
              <input type="hidden" name="jaPago" value={jaPago ? "on" : ""} />
              <input type="hidden" name="formaPagamento" value={jaPago ? formaPagamento : ""} />
              <input type="hidden" name="dataPagamento" value={jaPago ? dataPagamento : ""} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="baseSalary">Salário base do período (R$)</Label>
                <Input
                  id="baseSalary"
                  name="baseSalary"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryOverride}
                  onChange={(e) => setSalaryOverride(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ajuste aqui se o período for parcial (ex: só a quinzena).
                </p>
                {preview && preview.admissionUnworkedDays > 0 && (
                  <p className="text-xs text-amber-600">
                    Já proporcional: admitido no meio do mês, {30 - preview.admissionUnworkedDays} de
                    30 dias (salário cheio {currency(preview.baseSalary)}).
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Horas noturnas no período</span>
                  <span>{preview.totalNightHours.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Adicional noturno (20%)</span>
                  <span className="font-medium">{currency(preview.nightPremium)}</span>
                </div>
                {preview.overtimeMode === "HORA_EXTRA" ? (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">
                      Hora extra ({preview.overtimeHours.toFixed(2)}h)
                    </span>
                    <span className="font-medium">{currency(preview.overtimeAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Banco de horas (não afeta o valor)</span>
                    <span className="font-medium">{preview.bankedHours.toFixed(2)}h</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Desconto por atraso
                    {preview.lateMinutesTotal > 0 && (
                      <>
                        {" "}
                        ({preview.lateDiscountMinutes} de {preview.lateMinutesTotal} min — tolerância
                        legal de 5min por evento)
                      </>
                    )}
                  </span>
                  <span className="font-medium text-destructive">
                    -{currency(preview.lateDiscountAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Bônus</span>
                  <span className="font-medium text-primary">{currency(preview.bonusTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Pontuação de assiduidade/pontualidade ({preview.lateOccurrences} atraso
                    {preview.lateOccurrences === 1 ? "" : "s"}
                    {preview.absenceCount > 0
                      ? `, ${preview.absenceCount} falta/atestado — bônus zerado`
                      : ""}
                    )
                  </span>
                  <span className="font-medium">{preview.attendanceScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Sequência sem zerar {preview.absenceCount > 0 ? "(zerou este mês)" : ""}
                  </span>
                  <span className="font-medium">
                    {preview.attendanceStreakMonths} mês
                    {preview.attendanceStreakMonths === 1 ? "" : "es"}
                    {preview.attendanceStreakMultiplier > 1
                      ? ` (bônus x${preview.attendanceStreakMultiplier})`
                      : ""}
                  </span>
                </div>
                {preview.attendanceBonusAmount > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="applyAttendanceBonus-cb" className="flex items-center gap-2 text-neutral-500">
                      <Checkbox
                        id="applyAttendanceBonus-cb"
                        checked={applyAttendanceBonus}
                        onCheckedChange={(v) => setApplyAttendanceBonus(v === true)}
                      />
                      Bônus de assiduidade/pontualidade
                    </label>
                    <span className="font-medium text-primary">
                      {applyAttendanceBonus ? currency(preview.attendanceBonusAmount) : currency(0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Descontos</span>
                  <span className="font-medium text-destructive">
                    -{currency(preview.discountTotal)}
                  </span>
                </div>
                {adiantamentoTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Adiantamento (dia 20, 40%)</span>
                    <span className="font-medium text-destructive">
                      -{currency(adiantamentoTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Outros vales pendentes</span>
                  <span className="font-medium text-destructive">
                    -{currency(outrosValesTotal)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Descontos de carteira assinada (opcional)</p>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="applyFalta-cb" className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id="applyFalta-cb"
                        checked={applyFalta}
                        onCheckedChange={(v) => setApplyFalta(v === true)}
                      />
                      Faltas
                    </label>
                    {applyFalta && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={faltaDays}
                          onChange={(e) => setFaltaDays(e.target.value)}
                          className="h-8 w-20"
                        />
                        <span className="text-sm text-destructive">-{currency(faltaVal)}</span>
                      </div>
                    )}
                  </div>
                  {preview.faltaDatesAuto.length > 0 ? (
                    <p className="pl-6 text-xs text-muted-foreground">
                      Faltas registradas no período:{" "}
                      {preview.faltaDatesAuto.map((d) => d.split("-").reverse().join("/")).join(", ")}
                      {" "}({preview.faltaDatesAuto.length} dia
                      {preview.faltaDatesAuto.length === 1 ? "" : "s"})
                      {preview.faltaDsrDaysAuto > 0 &&
                        ` + ${preview.faltaDsrDaysAuto} dia${preview.faltaDsrDaysAuto === 1 ? "" : "s"} de DSR perdido`}
                      {preview.faltaHolidayDaysAuto > 0 &&
                        ` + ${preview.faltaHolidayDaysAuto} feriado${preview.faltaHolidayDaysAuto === 1 ? "" : "s"} na semana`}
                      {" "}= {preview.faltaDaysAuto} dia{preview.faltaDaysAuto === 1 ? "" : "s"}{" "}
                      descontado{preview.faltaDaysAuto === 1 ? "" : "s"} (1/30 do salário cada, Lei
                      605/49). Ajuste o número acima se precisar.
                      {preview.faltaDsrDaysAuto === 0 && (
                        <span className="mt-1 block text-amber-600">
                          Esse funcionário não tem folga fixa semanal cadastrada, então não dá pra
                          calcular o DSR perdido — só o dia da falta está contando. Cadastre a folga
                          fixa dele (editar funcionário) pra esse cálculo ficar completo.
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="pl-6 text-xs text-muted-foreground">
                      Nenhuma falta registrada no período. Se precisar descontar mesmo assim, marque
                      e informe os dias manualmente.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="applyInss-cb" className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="applyInss-cb"
                      checked={applyInss}
                      onCheckedChange={(v) => setApplyInss(v === true)}
                    />
                    INSS
                  </label>
                  {applyInss && <span className="text-sm text-destructive">-{currency(inssVal)}</span>}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="applyIrrf-cb" className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="applyIrrf-cb"
                      checked={applyIrrf}
                      onCheckedChange={(v) => setApplyIrrf(v === true)}
                    />
                    IRRF ({dependents} dependente{dependents === 1 ? "" : "s"})
                  </label>
                  {applyIrrf && <span className="text-sm text-destructive">-{currency(irrfVal)}</span>}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="applyVt-cb" className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="applyVt-cb"
                      checked={applyVt}
                      onCheckedChange={(v) => setApplyVt(v === true)}
                    />
                    Vale-transporte ({cltSettings.valeTransporteRate}%)
                  </label>
                  {applyVt && <span className="text-sm text-destructive">-{currency(vtVal)}</span>}
                </div>
              </div>

              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold">Líquido a pagar</span>
                <span className="font-semibold text-primary">
                  {currency(
                    salaryNum +
                      preview.nightPremium +
                      preview.overtimeAmount +
                      preview.bonusTotal +
                      (applyAttendanceBonus ? preview.attendanceBonusAmount : 0) -
                      preview.discountTotal -
                      preview.advancesTotal -
                      preview.lateDiscountAmount -
                      faltaVal -
                      inssVal -
                      irrfVal -
                      vtVal,
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <label htmlFor="jaPago-cb" className="flex items-center gap-2 text-sm">
                  <Checkbox id="jaPago-cb" checked={jaPago} onCheckedChange={(v) => setJaPago(v === true)} />
                  Já foi pago
                </label>
                {jaPago ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Forma de pagamento</Label>
                      <select
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value as "DINHEIRO" | "PIX")}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="PIX">Pix</option>
                        <option value="DINHEIRO">Dinheiro</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Data do pagamento</Label>
                      <Input
                        type="date"
                        value={dataPagamento}
                        onChange={(e) => setDataPagamento(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Senão vai pra Contas a Pagar, vencimento no 5º dia útil do mês seguinte (
                    {(() => {
                      const [y, m] = periodEnd.split("-").map(Number);
                      return nthBusinessDayOfMonth(y, m, 5).toLocaleDateString("pt-BR");
                    })()}
                    ).
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="note">Observação (opcional)</Label>
                <Textarea id="note" name="note" rows={2} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : "Confirmar pagamento"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
