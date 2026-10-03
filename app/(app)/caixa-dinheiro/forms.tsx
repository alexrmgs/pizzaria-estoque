"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { COINS } from "./coins";
import {
  salvarEntrada,
  salvarSaida,
  salvarMoedas,
  salvarMes,
  excluirEntrada,
  excluirMoedas,
} from "./actions";

const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// ---- Entrada (fechamento do dia / venda em dinheiro) ----
export function EntradaForm({ hoje }: { hoje: string }) {
  const router = useRouter();
  const [date, setDate] = useState(hoje);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await salvarEntrada({ date, description, amount: Number(amount) });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success("Entrada lançada ✅");
    setDescription("");
    setAmount("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Label className="text-xs">Descrição</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Fechamento 01/08"
          className="h-9 min-w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Valor (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-9 w-28"
        />
      </div>
      <Button onClick={submit} disabled={saving} className="h-9">
        {saving ? "..." : "Lançar"}
      </Button>
    </div>
  );
}

// ---- Saída (pagamento ou fundo de caixa) ----
export function SaidaForm({ hoje }: { hoje: string }) {
  const router = useRouter();
  const [date, setDate] = useState(hoje);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [tipo, setTipo] = useState<"PAGAMENTO" | "FUNDO">("PAGAMENTO");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const result = await salvarSaida({ date, description, amount: Number(amount), tipo });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success("Saída lançada ✅");
    setDescription("");
    setAmount("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <Label className="text-xs">Descrição</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Combustível"
          className="h-9 min-w-32"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Tipo</Label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "PAGAMENTO" | "FUNDO")}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="PAGAMENTO">Pagamento</option>
          <option value="FUNDO">Fundo de caixa</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Valor (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-9 w-28"
        />
      </div>
      <Button onClick={submit} disabled={saving} variant="secondary" className="h-9">
        {saving ? "..." : "Lançar"}
      </Button>
    </div>
  );
}

// ---- Movimentação de moedas ----
export function MoedaForm({ hoje }: { hoje: string }) {
  const router = useRouter();
  const [date, setDate] = useState(hoje);
  const [direction, setDirection] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const totalRs = COINS.reduce((s, c) => s + (Number(qtd[c.q]) || 0) * c.value, 0);

  async function submit() {
    setSaving(true);
    const result = await salvarMoedas({
      date,
      direction,
      q05: Number(qtd.q05) || 0,
      q10: Number(qtd.q10) || 0,
      q25: Number(qtd.q25) || 0,
      q50: Number(qtd.q50) || 0,
      q100: Number(qtd.q100) || 0,
    });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success("Movimentação de moedas lançada ✅");
    setQtd({});
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Tipo</Label>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "ENTRADA" | "SAIDA")}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="ENTRADA">Entrada (recebi moedas)</option>
          <option value="SAIDA">Saída (usei no fundo)</option>
        </select>
      </div>
      {COINS.map((c) => (
        <div key={c.q} className="flex flex-col gap-1">
          <Label className="text-xs">{c.label}</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={qtd[c.q] ?? ""}
            onChange={(e) => setQtd((p) => ({ ...p, [c.q]: e.target.value }))}
            placeholder="0"
            className="h-9 w-20"
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Total</span>
        <span className="text-sm font-bold">R$ {money(totalRs)}</span>
      </div>
      <Button onClick={submit} disabled={saving} className="h-9">
        {saving ? "..." : "Lançar"}
      </Button>
    </div>
  );
}

// ---- Configuração do mês (saldo inicial, estoque inicial de moedas, virada) ----
type ConfigForm = {
  month: string;
  saldoInicial: number;
  saldoAnterior: number | null;
  ini05: number;
  ini10: number;
  ini25: number;
  ini50: number;
  ini100: number;
  cedulasContadas: number | null;
  moedasContadas: number | null;
};

type Anterior = {
  month: string;
  temDados: boolean;
  saldoFinal: number;
  moedas: Record<(typeof COINS)[number]["ini"], number>;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Abertura do mês: ou puxa o saldo final (e as moedas que sobraram) do mês
 * anterior, ou faz a conferência manual — conta cédulas e moedas, e essa
 * contagem vira o saldo inicial (mostrando a diferença pro mês anterior).
 */
export function MesDialog({ config, anterior }: { config: ConfigForm; anterior: Anterior }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modo, setModo] = useState<"anterior" | "manual">(
    config.cedulasContadas != null || config.moedasContadas != null ? "manual" : "anterior",
  );
  const [cedulas, setCedulas] = useState(
    config.cedulasContadas != null ? String(config.cedulasContadas) : "",
  );
  const [qtd, setQtd] = useState<Record<string, string>>(() =>
    Object.fromEntries(COINS.map((c) => [c.ini, String(config[c.ini] ?? 0)])),
  );

  const moedasContadas = COINS.reduce((s, c) => s + (Number(qtd[c.ini]) || 0) * c.value, 0);
  const totalContado = (Number(cedulas.replace(",", ".")) || 0) + moedasContadas;
  const diferenca = totalContado - anterior.saldoFinal;

  async function submit() {
    setSaving(true);
    const result =
      modo === "anterior"
        ? await salvarMes({
            month: config.month,
            saldoInicial: anterior.saldoFinal,
            saldoAnterior: anterior.saldoFinal,
            ...anterior.moedas,
          })
        : await salvarMes({
            month: config.month,
            saldoInicial: Math.round(totalContado * 100) / 100,
            saldoAnterior: anterior.saldoFinal,
            ini05: Number(qtd.ini05) || 0,
            ini10: Number(qtd.ini10) || 0,
            ini25: Number(qtd.ini25) || 0,
            ini50: Number(qtd.ini50) || 0,
            ini100: Number(qtd.ini100) || 0,
            cedulasContadas: Number(cedulas.replace(",", ".")) || 0,
            moedasContadas: Math.round(moedasContadas * 100) / 100,
          });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success("Mês configurado ✅");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Configurar mês</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir o mês {config.month}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={modo === "anterior" ? "default" : "outline"}
              onClick={() => setModo("anterior")}
            >
              Puxar do mês anterior
            </Button>
            <Button
              type="button"
              variant={modo === "manual" ? "default" : "outline"}
              onClick={() => setModo("manual")}
            >
              Conferência manual
            </Button>
          </div>

          {modo === "anterior" ? (
            <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3 text-sm">
              {anterior.temDados ? (
                <>
                  <p>
                    Saldo final de {anterior.month}:{" "}
                    <span className="font-semibold">{brl(anterior.saldoFinal)}</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Moedas que sobraram:{" "}
                    {COINS.map((c) => `${anterior.moedas[c.ini]}× ${c.label}`).join(" · ")}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Esse saldo e essas moedas viram o início de {config.month}.
                  </p>
                </>
              ) : (
                <p className="text-amber-700">
                  {anterior.month} não tem lançamentos — o mês começa zerado. Use a conferência
                  manual se tem dinheiro no caixa.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>Cédulas contadas (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={cedulas}
                  onChange={(e) => setCedulas(e.target.value)}
                  placeholder="Ex: 850,00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Moedas contadas (quantidade)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {COINS.map((c) => (
                    <div key={c.ini} className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">{c.label}</span>
                      <Input
                        type="number"
                        min="0"
                        value={qtd[c.ini]}
                        onChange={(e) => setQtd((p) => ({ ...p, [c.ini]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-neutral-50 p-3 text-sm">
                <p>
                  Total contado: <span className="font-semibold">{brl(totalContado)}</span>{" "}
                  <span className="text-xs text-neutral-500">(moedas {brl(moedasContadas)})</span>
                </p>
                <p className="text-xs text-neutral-500">
                  Saldo do sistema no fim de {anterior.month}: {brl(anterior.saldoFinal)}
                </p>
                {Math.abs(diferenca) >= 0.01 && (
                  <p className={diferenca < 0 ? "font-medium text-destructive" : "font-medium text-emerald-700"}>
                    Diferença: {diferenca > 0 ? "+" : ""}
                    {brl(diferenca)} {diferenca < 0 ? "(faltando)" : "(sobrando)"}
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-500">
                  O total contado vira o saldo inicial de {config.month}.
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Excluir linha (entrada/saída ou moeda) ----
export function ExcluirLinha({ id, tipo }: { id: string; tipo: "entrada" | "moeda" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este lançamento?")) return;
    startTransition(async () => {
      const result = tipo === "entrada" ? await excluirEntrada(id) : await excluirMoedas(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Excluído");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={excluir}
      disabled={isPending}
      className="text-neutral-400 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
