"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelarVenda } from "@/app/(pdv)/pdv/[storeId]/actions";

export function CupomAcoes({
  storeId,
  vendaId,
  voltar,
  autoImprimir,
  podeCancelar,
}: {
  storeId: string;
  vendaId: string;
  voltar: string;
  autoImprimir: boolean;
  podeCancelar: boolean;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();

  // Vindo do "Cobrar": abre a impressão sozinho e, ao terminar (imprimiu ou
  // cancelou o diálogo), volta pra tela de venda.
  useEffect(() => {
    if (!autoImprimir) return;
    const depois = () => router.replace(voltar);
    window.addEventListener("afterprint", depois, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", depois);
    };
  }, [autoImprimir, voltar, router]);

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
    <div className="flex w-[72mm] flex-wrap gap-2 print:hidden">
      <Button size="lg" className="flex-1" onClick={() => window.print()}>
        Imprimir
      </Button>
      <Button size="lg" variant="outline" className="flex-1" render={<Link href={voltar} />}>
        Voltar
      </Button>
      {podeCancelar ? (
        <Button size="lg" variant="destructive" className="w-full" onClick={cancelar} disabled={pendente}>
          Cancelar pedido
        </Button>
      ) : null}
    </div>
  );
}
