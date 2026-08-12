"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imprimirPedidoAuto, ajustarProximoNumero, reimprimirVolume } from "./actions";
import { imprimirTspl } from "./ble-print";
import { buildPedidoTspl, buildVolumeTspl } from "./tspl";

export function FilaPedidos({
  proximoNumero,
  widthMm,
  heightMm,
}: {
  proximoNumero: number;
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<number | null>(null);
  const [volumes, setVolumes] = useState(1);
  const [cliente, setCliente] = useState("");
  const [isPending, startTransition] = useTransition();
  const [printing, setPrinting] = useState(false);
  const [editando, setEditando] = useState(false);
  const [novoInicio, setNovoInicio] = useState(String(proximoNumero));

  // Reimpressão de uma etiqueta específica.
  const [rePedido, setRePedido] = useState("");
  const [reVolume, setReVolume] = useState("1");
  const [reTotal, setReTotal] = useState("3");

  // Mostra os próximos 20 números aguardando etiqueta.
  const fila = Array.from({ length: 20 }, (_, i) => proximoNumero + i);

  function abrir(numero: number) {
    setAberto(numero);
    setVolumes(1);
    setCliente("");
  }

  async function imprimir() {
    if (aberto == null) return;
    setPrinting(true);
    try {
      const tspl = buildPedidoTspl({ numero: aberto, cliente, volumes, widthMm, heightMm });
      await imprimirTspl(tspl);
    } catch (e) {
      setPrinting(false);
      toast.error("Não imprimiu: " + (e instanceof Error ? e.message : "erro no Bluetooth"));
      return;
    }
    const result = await imprimirPedidoAuto({ numero: aberto, volumes, cliente, impresso: true });
    setPrinting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Pedido ${aberto} impresso ✅`);
    setAberto(null);
    router.refresh();
  }

  function salvarInicio() {
    startTransition(async () => {
      const result = await ajustarProximoNumero(Number(novoInicio));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Número ajustado ✅");
      setEditando(false);
      router.refresh();
    });
  }

  function resetar() {
    if (!confirm("Voltar a numeração para o pedido 1?")) return;
    startTransition(async () => {
      const result = await ajustarProximoNumero(1);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Numeração reiniciada do 1 ✅");
      router.refresh();
    });
  }

  async function reimprimir() {
    if (!rePedido.trim()) {
      toast.error("Informe o número do pedido.");
      return;
    }
    setPrinting(true);
    try {
      const tspl = buildVolumeTspl({
        numero: rePedido.trim(),
        volume: Number(reVolume),
        volumes: Number(reTotal),
        widthMm,
        heightMm,
      });
      await imprimirTspl(tspl);
    } catch (e) {
      setPrinting(false);
      toast.error("Não imprimiu: " + (e instanceof Error ? e.message : "erro no Bluetooth"));
      return;
    }
    const result = await reimprimirVolume({
      pedido: rePedido,
      volume: Number(reVolume),
      volumes: Number(reTotal),
      impresso: true,
    });
    setPrinting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Reimpresso: pedido ${rePedido.trim()} (${reVolume}/${reTotal}) ✅`);
    setRePedido("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-neutral-500">
          Próximos pedidos na fila
        </p>
        <div className="flex items-center gap-3">
          {editando ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={novoInicio}
                onChange={(e) => setNovoInicio(e.target.value)}
                className="h-8 w-24"
              />
              <Button size="sm" className="h-8" onClick={salvarInicio} disabled={isPending}>
                Salvar
              </Button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="text-xs text-neutral-400 underline"
              >
                cancelar
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setNovoInicio(String(proximoNumero));
                  setEditando(true);
                }}
                className="flex items-center gap-1 text-xs text-neutral-400 underline hover:text-neutral-600"
              >
                <Pencil className="size-3" /> ajustar número
              </button>
              <button
                type="button"
                onClick={resetar}
                disabled={isPending}
                className="flex items-center gap-1 text-xs text-neutral-400 underline hover:text-red-600"
              >
                <RotateCcw className="size-3" /> resetar pro 1
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {fila.map((numero, i) => (
          <button
            key={numero}
            type="button"
            onClick={() => abrir(numero)}
            className={
              "flex aspect-square flex-col items-center justify-center rounded-lg border-2 bg-white transition-colors hover:border-primary hover:bg-primary/5 " +
              (i === 0 ? "border-primary/60 ring-2 ring-primary/20" : "border-neutral-200")
            }
          >
            <span className="text-[9px] font-semibold uppercase text-neutral-400">Pedido</span>
            <span className="text-2xl font-black leading-none">{numero}</span>
          </button>
        ))}
      </div>

      {/* Reimpressão de uma etiqueta específica */}
      <div className="mt-2 max-w-lg rounded-lg border bg-white p-4">
        <p className="text-xs font-semibold uppercase text-neutral-500">Reimprimir uma etiqueta</p>
        <p className="mt-1 text-xs text-neutral-400">
          Perdeu ou rasgou uma etiqueta? Reimprime só ela (ex: pedido 5, volume 2 de 3).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Pedido</label>
            <Input
              inputMode="numeric"
              value={rePedido}
              onChange={(e) => setRePedido(e.target.value)}
              placeholder="Ex: 5"
              className="h-10 w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Volume</label>
            <Input
              type="number"
              min="1"
              value={reVolume}
              onChange={(e) => setReVolume(e.target.value)}
              className="h-10 w-20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">De</label>
            <Input
              type="number"
              min="1"
              value={reTotal}
              onChange={(e) => setReTotal(e.target.value)}
              className="h-10 w-20"
            />
          </div>
          <Button
            variant="outline"
            onClick={reimprimir}
            disabled={printing}
            className="h-10"
          >
            {printing ? "Imprimindo…" : "Reimprimir"}
          </Button>
        </div>
      </div>

      {aberto != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAberto(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-neutral-500">Pedido Delivery</p>
            <p className="text-5xl font-black leading-none">{aberto}</p>

            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente (opcional)"
              className="mt-3 h-9 border-0 border-b border-neutral-200 px-0 text-base text-neutral-600 shadow-none focus-visible:ring-0"
            />

            <p className="mt-6 text-base font-semibold">Quantos volumes (caixas)?</p>
            <div className="mt-3 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => setVolumes((v) => Math.max(1, v - 1))}
                className="flex size-14 items-center justify-center rounded-full border-2 border-neutral-200 text-2xl hover:bg-neutral-50"
              >
                <Minus className="size-6" />
              </button>
              <span className="w-12 text-center text-4xl font-black">{volumes}</span>
              <button
                type="button"
                onClick={() => setVolumes((v) => Math.min(50, v + 1))}
                className="flex size-14 items-center justify-center rounded-full border-2 border-neutral-200 text-2xl hover:bg-neutral-50"
              >
                <Plus className="size-6" />
              </button>
            </div>

            <Button
              onClick={imprimir}
              disabled={printing}
              className="mt-6 h-14 w-full rounded-xl text-lg font-bold"
            >
              {printing
                ? "Imprimindo…"
                : `Imprimir ${volumes} ${volumes === 1 ? "etiqueta" : "etiquetas"}`}
            </Button>
            <button
              type="button"
              onClick={() => setAberto(null)}
              className="mt-3 w-full text-center text-sm text-neutral-400 hover:text-neutral-600"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
