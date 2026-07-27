"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reopenPayment } from "./[id]/actions";

export function ReopenPaymentButton({
  employeeId,
  paymentId,
}: {
  employeeId: string;
  paymentId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Reabrir este pagamento? Ele será apagado e os vales/bônus/descontos vinculados voltam a ficar pendentes, pra você corrigir e fechar de novo.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await reopenPayment(employeeId, paymentId);
      toast.success("Pagamento reaberto. Os vales e ajustes voltaram para pendente.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? "Reabrindo..." : "Reabrir"}
    </Button>
  );
}
