"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { darBaixaLote } from "./actions";
import { imprimirTspl } from "../etiquetas/ble-print";
import { buildProducaoTspl } from "../etiquetas/tspl";

const SITE_URL = "https://fbgestao.com";

function formatBR(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function LoteRowActions({
  lote,
  empresa,
  widthMm,
  heightMm,
}: {
  lote: {
    id: string;
    ingredientName: string;
    unit: string;
    quantity: number;
    producedAt: Date;
    expiresAt: Date | null;
    status: "ATIVO" | "BAIXADO";
  };
  empresa: { nome: string; cnpj: string; endereco: string; cep: string; cidade: string };
  widthMm: number;
  heightMm: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function reimprimir() {
    startTransition(async () => {
      try {
        const tspl = buildProducaoTspl({
          produto: lote.ingredientName,
          temperatura: "",
          peso: `${lote.quantity} ${lote.unit}`,
          fabricacao: formatBR(lote.producedAt),
          validade: formatBR(lote.expiresAt),
          responsavel: "",
          empresaNome: empresa.nome,
          empresaCnpj: empresa.cnpj,
          empresaCidade: empresa.cidade,
          copias: 1,
          widthMm,
          heightMm,
          qrContent: `${SITE_URL}/lotes/${lote.id}`,
        });
        await imprimirTspl(tspl);
        toast.success("Reimpresso ✅");
      } catch (e) {
        toast.error("Não imprimiu: " + (e instanceof Error ? e.message : "erro no Bluetooth"));
      }
    });
  }

  function baixar() {
    if (!confirm(`Dar baixa em ${lote.quantity} ${lote.unit} de ${lote.ingredientName}?`)) return;
    startTransition(async () => {
      const result = await darBaixaLote(lote.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Baixa registrada ✅");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" disabled={isPending} onClick={reimprimir}>
        Reimprimir
      </Button>
      {lote.status === "ATIVO" && (
        <Button variant="secondary" size="sm" disabled={isPending} onClick={baixar}>
          Dar baixa
        </Button>
      )}
    </div>
  );
}
