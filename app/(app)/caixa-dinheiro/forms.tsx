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

export function MesDialog({ config }: { config: ConfigForm }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    saldoInicial: String(config.saldoInicial),
    saldoAnterior: config.saldoAnterior != null ? String(config.saldoAnterior) : "",
    ini05: String(config.ini05),
    ini10: String(config.ini10),
    ini25: String(config.ini25),
    ini50: String(config.ini50),
    ini100: String(config.ini100),
    cedulasContadas: config.cedulasContadas != null ? String(config.cedulasContadas) : "",
    moedasContadas: config.moedasContadas != null ? String(config.moedasContadas) : "",
  });

  const iniKeys = COINS.map((c) => c.ini);

  async function submit() {
    setSaving(true);
    const result = await salvarMes({
      month: config.month,
      saldoInicial: Number(f.saldoInicial) || 0,
      saldoAnterior: f.saldoAnterior === "" ? undefined : Number(f.saldoAnterior),
      ini05: Number(f.ini05) || 0,
      ini10: Number(f.ini10) || 0,
      ini25: Number(f.ini25) || 0,
      ini50: Number(f.ini50) || 0,
      ini100: Number(f.ini100) || 0,
      cedulasContadas: f.cedulasContadas === "" ? undefined : Number(f.cedulasContadas),
      moedasContadas: f.moedasContadas === "" ? undefined : Number(f.moedasContadas),
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
          <DialogTitle>Configurar {config.month}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Saldo inicial (dinheiro no início do mês)</Label>
            <Input
              type="number"
              step="0.01"
              value={f.saldoInicial}
              onChange={(e) => setF((p) => ({ ...p, saldoInicial: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Estoque inicial de moedas (quantidade)</Label>
            <div className="grid grid-cols-5 gap-2">
              {COINS.map((c, i) => (
                <div key={c.ini} className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-500">{c.label}</span>
                  <Input
                    type="number"
                    min="0"
                    value={f[iniKeys[i] as keyof typeof f]}
                    onChange={(e) =>
                      setF((p) => ({ ...p, [iniKeys[i]]: e.target.value }))
                    }
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm font-semibold">Virada de mês (opcional)</Label>
            <p className="mb-2 text-xs text-neutral-500">
              Contagem física do dinheiro pra conferir a diferença com o mês anterior.
            </p>
            <div className="mb-3 flex flex-col gap-1">
              <span className="text-xs text-neutral-500">Saldo final do mês anterior (R$)</span>
              <Input
                type="number"
                step="0.01"
                value={f.saldoAnterior}
                onChange={(e) => setF((p) => ({ ...p, saldoAnterior: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">Cédulas contadas (R$)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={f.cedulasContadas}
                  onChange={(e) => setF((p) => ({ ...p, cedulasContadas: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">Moedas contadas (R$)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={f.moedasContadas}
                  onChange={(e) => setF((p) => ({ ...p, moedasContadas: e.target.value }))}
                />
              </div>
            </div>
          </div>
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
