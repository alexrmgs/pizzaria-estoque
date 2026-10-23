"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
import { toast } from "sonner";

import { imprimirViaEmSegundoPlano } from "@/components/pdv/imprimir";
import { PdvButton } from "@/components/pdv/primitives";
import { cancelarVenda, moverStatus } from "../../actions";

export function PedidoAcoes({
  storeId,
  vendaId,
  podeVoltar,
  podeAvancar,
  podeCancelar,
}: {
  storeId: string;
  vendaId: string;
  podeVoltar: boolean;
  podeAvancar: boolean;
  podeCancelar: boolean;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();

  function mover(sentido: 1 | -1) {
    start(async () => {
      const r = await moverStatus(storeId, vendaId, sentido);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function cancelar() {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo?.trim()) return;
    start(async () => {
      const r = await cancelarVenda(storeId, vendaId, motivo);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Pedido cancelado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {podeVoltar ? (
        <PdvButton onClick={() => mover(-1)} disabled={pendente}>
          <ChevronLeft /> Voltar status
        </PdvButton>
      ) : null}
      {podeAvancar ? (
        <PdvButton variant="primary" onClick={() => mover(1)} disabled={pendente}>
          Avançar status <ChevronRight />
        </PdvButton>
      ) : null}
      <PdvButton
        onClick={() => {
          imprimirViaEmSegundoPlano(vendaId);
          toast("Imprimindo a via…");
        }}
      >
        <Printer /> Reimprimir
      </PdvButton>
      {podeCancelar ? (
        <PdvButton variant="danger" className="ml-auto" onClick={cancelar} disabled={pendente}>
          <X /> Cancelar pedido
        </PdvButton>
      ) : null}
    </div>
  );
}
