"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { imprimirPedidoAuto, ajustarProximoNumero } from "./actions";

export function FilaPedidos({ proximoNumero }: { proximoNumero: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<number | null>(null);
  const [volumes, setVolumes] = useState(1);
  const [cliente, setCliente] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [novoInicio, setNovoInicio] = useState(String(proximoNumero));

  // Mostra os próximos 5 números aguardando etiqueta.
  const fila = Array.from({ length: 5 }, (_, i) => proximoNumero + i);

  function abrir(numero: number) {
    setAberto(numero);
    setVolumes(1);
    setCliente("");
  }

  function fechar() {
    setAberto(null);
  }

  function imprimir() {
    if (aberto == null) return;
    startTransition(async () => {
      const result = await imprimirPedidoAuto({ numero: aberto, volumes, cliente });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pedido ${aberto} enviado ✅`);
      setAberto(null);
      router.refresh();
    });
  }

  function salvarInicio() {
    const n = Number(novoInicio);
    startTransition(async () => {
      const result = await ajustarProximoNumero(n);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Número ajustado ✅");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-neutral-500">
          Próximos pedidos na fila
        </p>
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
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {fila.map((numero, i) => (
          <button
            key={numero}
            type="button"
            onClick={() => abrir(numero)}
            className={
              "flex aspect-square flex-col items-center justify-center rounded-xl border-2 bg-white transition-colors hover:border-primary hover:bg-primary/5 " +
              (i === 0 ? "border-primary/60 ring-2 ring-primary/20" : "border-neutral-200")
            }
          >
            <span className="text-[11px] font-semibold uppercase text-neutral-400">Pedido</span>
            <span className="text-4xl font-black leading-none">{numero}</span>
            <span className="mt-1 text-[11px] text-neutral-400">
              {i === 0 ? "próximo" : "aguardando"}
            </span>
          </button>
        ))}
      </div>

      {aberto != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={fechar}
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
              disabled={isPending}
              className="mt-6 h-14 w-full rounded-xl text-lg font-bold"
            >
              Imprimir {volumes} {volumes === 1 ? "etiqueta" : "etiquetas"}
            </Button>
            <button
              type="button"
              onClick={fechar}
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
