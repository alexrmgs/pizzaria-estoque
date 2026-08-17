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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { getTerminationPreview, demitirComRescisao, type TerminationPreviewData } from "./actions";
import { computeRescisao, type AvisoPrevioTipo, type TerminationReason } from "@/lib/rescisao";
import { todayInBrazil } from "@/lib/payroll";

const currency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");

const REASON_LABELS: Record<TerminationReason, string> = {
  SEM_JUSTA_CAUSA: "Dispensa sem justa causa",
  PEDIDO_DEMISSAO: "Pedido de demissão",
  JUSTA_CAUSA: "Dispensa por justa causa",
  ACORDO: "Acordo mútuo (distrato)",
};

export function TerminationDialog({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<TerminationPreviewData | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const [dismissalDate, setDismissalDate] = useState(() => todayInBrazil().toISOString().slice(0, 10));
  const [reason, setReason] = useState<TerminationReason>("SEM_JUSTA_CAUSA");
  const [avisoPrevio, setAvisoPrevio] = useState<AvisoPrevioTipo>("INDENIZADO");
  const [lastVacationDate, setLastVacationDate] = useState("");
  const [fgtsBalance, setFgtsBalance] = useState("0");
  const [applyAvisoNaoCumpridoDiscount, setApplyAvisoNaoCumpridoDiscount] = useState(true);
  const [applyPendingAdvancesDiscount, setApplyPendingAdvancesDiscount] = useState(true);
  const [applyPendingDiscountsDiscount, setApplyPendingDiscountsDiscount] = useState(true);
  const [applyInssDiscount, setApplyInssDiscount] = useState(true);
  const [applyIrrfDiscount, setApplyIrrfDiscount] = useState(true);
  const [jaPago, setJaPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<"DINHEIRO" | "PIX">("DINHEIRO");
  const [note, setNote] = useState("");

  function loadPreview() {
    startTransition(async () => {
      const result = await getTerminationPreview(employeeId);
      if ("error" in result) {
        setError(result.error);
        setPreview(null);
      } else {
        setError(undefined);
        setPreview(result);
        setLastVacationDate(result.suggestedLastVacationDate || result.hireDate || dismissalDate);
      }
    });
  }

  const empregadorDispensa = reason === "SEM_JUSTA_CAUSA" || reason === "ACORDO";

  const result = useMemo(() => {
    if (!preview) return null;
    const hireDate = preview.hireDate ? new Date(`${preview.hireDate}T00:00:00Z`) : null;
    const lastVac = lastVacationDate ? new Date(`${lastVacationDate}T00:00:00Z`) : null;
    if (!hireDate || !lastVac) return null;
    return computeRescisao({
      baseSalary: preview.baseSalary,
      hireDate,
      dismissalDate: new Date(`${dismissalDate}T00:00:00Z`),
      reason,
      avisoPrevio: reason === "JUSTA_CAUSA" ? null : avisoPrevio,
      lastVacationDate: lastVac,
      fgtsBalance: Number(fgtsBalance) || 0,
      pendingAdvances: preview.pendingAdvancesTotal,
      pendingDiscounts: preview.pendingDiscountsTotal,
      pendingBonuses: preview.pendingBonusesTotal,
      applyAvisoNaoCumpridoDiscount,
      applyPendingAdvancesDiscount,
      applyPendingDiscountsDiscount,
      applyInssDiscount,
      applyIrrfDiscount,
      dependents: preview.dependents,
      inssBrackets: preview.cltSettings.inssBrackets,
      irrfBrackets: preview.cltSettings.irrfBrackets,
      irrfDependentDeduction: preview.cltSettings.irrfDependentDeduction,
    });
  }, [
    preview,
    dismissalDate,
    reason,
    avisoPrevio,
    lastVacationDate,
    fgtsBalance,
    applyAvisoNaoCumpridoDiscount,
    applyPendingAdvancesDiscount,
    applyPendingDiscountsDiscount,
    applyInssDiscount,
    applyIrrfDiscount,
  ]);

  function handleConfirm(formData: FormData) {
    if (
      !confirm(
        `Confirmar rescisão de "${employeeName}"? Ele deixa de aparecer em Pagamentos e Vales, e uma conta de ${
          result ? currency(result.totalLiquido) : ""
        } vai pra ${jaPago ? "Contas Pagas" : "Contas a Pagar"}.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await demitirComRescisao(employeeId, undefined, formData);
      if (r?.error) {
        toast.error(r.error);
      } else {
        toast.success(`${employeeName} foi desligado — rescisão calculada.`);
        setOpen(false);
        setPreview(null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPreview(null);
          setError(undefined);
          setDismissalDate(todayInBrazil().toISOString().slice(0, 10));
          setReason("SEM_JUSTA_CAUSA");
          setAvisoPrevio("INDENIZADO");
          setFgtsBalance("0");
          setApplyAvisoNaoCumpridoDiscount(true);
          setApplyPendingAdvancesDiscount(true);
          setApplyPendingDiscountsDiscount(true);
          setApplyInssDiscount(true);
          setApplyIrrfDiscount(true);
          setJaPago(false);
          setNote("");
          loadPreview();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            Demitir
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rescisão — {employeeName}</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!preview && !error && <p className="text-sm text-neutral-500">Carregando...</p>}

        {preview && (
          <form action={handleConfirm} className="flex flex-col gap-4">
            <input type="hidden" name="dismissalDate" value={dismissalDate} />
            <input type="hidden" name="reason" value={reason} />
            <input type="hidden" name="avisoPrevio" value={reason === "JUSTA_CAUSA" ? "" : avisoPrevio} />
            <input type="hidden" name="lastVacationDate" value={lastVacationDate} />
            <input type="hidden" name="fgtsBalance" value={fgtsBalance} />
            <input
              type="hidden"
              name="applyAvisoNaoCumpridoDiscount"
              value={applyAvisoNaoCumpridoDiscount ? "on" : ""}
            />
            <input
              type="hidden"
              name="applyPendingAdvancesDiscount"
              value={applyPendingAdvancesDiscount ? "on" : ""}
            />
            <input
              type="hidden"
              name="applyPendingDiscountsDiscount"
              value={applyPendingDiscountsDiscount ? "on" : ""}
            />
            <input type="hidden" name="applyInssDiscount" value={applyInssDiscount ? "on" : ""} />
            <input type="hidden" name="applyIrrfDiscount" value={applyIrrfDiscount ? "on" : ""} />
            <input type="hidden" name="jaPago" value={jaPago ? "on" : ""} />
            <input type="hidden" name="formaPagamento" value={jaPago ? formaPagamento : ""} />
            <input type="hidden" name="note" value={note} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Data de desligamento</Label>
                <Input
                  type="date"
                  value={dismissalDate}
                  onChange={(e) => setDismissalDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Motivo</Label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as TerminationReason)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {(Object.keys(REASON_LABELS) as TerminationReason[]).map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {reason !== "JUSTA_CAUSA" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Aviso prévio</Label>
                  <select
                    value={avisoPrevio}
                    onChange={(e) => setAvisoPrevio(e.target.value as AvisoPrevioTipo)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {empregadorDispensa ? (
                      <>
                        <option value="INDENIZADO">Indenizado (empresa dispensa)</option>
                        <option value="TRABALHADO">Trabalhado (já cumpriu)</option>
                      </>
                    ) : (
                      <>
                        <option value="TRABALHADO">Cumpriu os 30 dias</option>
                        <option value="DISPENSADO">Não cumpriu (desconta 1 salário)</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Início do período aquisitivo de férias</Label>
                <Input
                  type="date"
                  value={lastVacationDate}
                  onChange={(e) => setLastVacationDate(e.target.value)}
                  className="h-9"
                />
                <span className="text-[11px] text-neutral-400">
                  Data da última vez que tirou férias (ou admissão, se nunca tirou).
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Saldo do FGTS (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fgtsBalance}
                  onChange={(e) => setFgtsBalance(e.target.value)}
                  className="h-9"
                />
                <span className="text-[11px] text-neutral-400">
                  Pra estimar a multa de {reason === "ACORDO" ? "20%" : "40%"}. Deixe 0 se não souber.
                </span>
              </div>
            </div>

            {result && (
              <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Saldo de salário ({new Date(`${dismissalDate}T00:00:00Z`).getUTCDate()} dia(s))</span>
                  <span className="font-medium">{currency(result.saldoSalario)}</span>
                </div>
                {result.avisoIndenizadoValor > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">
                      Aviso prévio indenizado ({result.avisoPrevioDays} dias)
                    </span>
                    <span className="font-medium">{currency(result.avisoIndenizadoValor)}</span>
                  </div>
                )}
                {result.anosFeriasVencidas > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">
                      Férias vencidas + 1/3 ({result.anosFeriasVencidas} período(s))
                    </span>
                    <span className="font-medium">{currency(result.feriasVencidas)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    Férias proporcionais + 1/3 ({result.mesesFeriasProporcionais}/12)
                  </span>
                  <span className="font-medium">{currency(result.feriasProporcionais)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">
                    13º proporcional ({result.mesesDecimoTerceiro}/12)
                  </span>
                  <span className="font-medium">{currency(result.decimoTerceiroProporcional)}</span>
                </div>
                {preview.pendingBonusesTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Bônus pendentes</span>
                    <span className="font-medium">{currency(preview.pendingBonusesTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="applyInssDiscount-cb" className="flex items-center gap-2 text-neutral-500">
                    <Checkbox
                      id="applyInssDiscount-cb"
                      checked={applyInssDiscount}
                      onCheckedChange={(v) => setApplyInssDiscount(v === true)}
                    />
                    INSS (saldo + 13º)
                  </label>
                  <span className="font-medium text-destructive">
                    -{currency(applyInssDiscount ? result.inssSaldoSalario + result.inssDecimoTerceiro : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="applyIrrfDiscount-cb" className="flex items-center gap-2 text-neutral-500">
                    <Checkbox
                      id="applyIrrfDiscount-cb"
                      checked={applyIrrfDiscount}
                      onCheckedChange={(v) => setApplyIrrfDiscount(v === true)}
                    />
                    IRRF (saldo + 13º)
                  </label>
                  <span className="font-medium text-destructive">
                    -{currency(applyIrrfDiscount ? result.irrfSaldoSalario + result.irrfDecimoTerceiro : 0)}
                  </span>
                </div>
                {preview.pendingAdvancesTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="applyPendingAdvancesDiscount-cb"
                      className="flex items-center gap-2 text-neutral-500"
                    >
                      <Checkbox
                        id="applyPendingAdvancesDiscount-cb"
                        checked={applyPendingAdvancesDiscount}
                        onCheckedChange={(v) => setApplyPendingAdvancesDiscount(v === true)}
                      />
                      Vales pendentes
                    </label>
                    <span className="font-medium text-destructive">
                      -{currency(applyPendingAdvancesDiscount ? preview.pendingAdvancesTotal : 0)}
                    </span>
                  </div>
                )}
                {preview.pendingDiscountsTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="applyPendingDiscountsDiscount-cb"
                      className="flex items-center gap-2 text-neutral-500"
                    >
                      <Checkbox
                        id="applyPendingDiscountsDiscount-cb"
                        checked={applyPendingDiscountsDiscount}
                        onCheckedChange={(v) => setApplyPendingDiscountsDiscount(v === true)}
                      />
                      Descontos pendentes
                    </label>
                    <span className="font-medium text-destructive">
                      -{currency(applyPendingDiscountsDiscount ? preview.pendingDiscountsTotal : 0)}
                    </span>
                  </div>
                )}
                {reason === "PEDIDO_DEMISSAO" && avisoPrevio === "DISPENSADO" && (
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="applyAvisoNaoCumpridoDiscount-cb"
                      className="flex items-center gap-2 text-neutral-500"
                    >
                      <Checkbox
                        id="applyAvisoNaoCumpridoDiscount-cb"
                        checked={applyAvisoNaoCumpridoDiscount}
                        onCheckedChange={(v) => setApplyAvisoNaoCumpridoDiscount(v === true)}
                      />
                      Aviso prévio não cumprido
                    </label>
                    <span className="font-medium text-destructive">
                      -{currency(result.descontoAvisoNaoCumprido)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-base">
                  <span className="font-semibold">Líquido da rescisão</span>
                  <span className="font-semibold text-primary">{currency(result.totalLiquido)}</span>
                </div>
                {result.multaFgts > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">
                      Multa FGTS ({result.multaFgtsRate * 100}%, informativa — depositada na conta
                      vinculada, não entra no líquido acima)
                    </span>
                    <span className="text-neutral-500">{currency(result.multaFgts)}</span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-neutral-400">
                  Projeção do fim do contrato: {brDate(result.projectedEndDate.toISOString().slice(0, 10))}.
                  Cálculo estimado seguindo as regras padrão da CLT — confira com o contador antes de
                  pagar em casos fora do comum.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <label htmlFor="jaPago-cb" className="flex items-center gap-2 text-sm">
                <Checkbox id="jaPago-cb" checked={jaPago} onCheckedChange={(v) => setJaPago(v === true)} />
                Já foi paga (senão vai pra Contas a Pagar, vencimento em 10 dias)
              </label>
              {jaPago && (
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value as "DINHEIRO" | "PIX")}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="PIX">Pix</option>
                </select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="termination-note">Observação (opcional)</Label>
              <Textarea
                id="termination-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending} variant="destructive">
                {isPending ? "Salvando..." : "Confirmar rescisão"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
