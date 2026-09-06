"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { payMadrugadaForEmployee } from "./actions";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PayMadrugadaButton({
  employeeId,
  employeeName,
  amount,
}: {
  employeeId: string;
  employeeName: string;
  amount: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Marcar ${currency(amount)} como pago pra ${employeeName}?`)) return;
        startTransition(async () => {
          const result = await payMadrugadaForEmployee(employeeId);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Pagamento de madrugada registrado.");
          }
        });
      }}
    >
      Pagar
    </Button>
  );
}
