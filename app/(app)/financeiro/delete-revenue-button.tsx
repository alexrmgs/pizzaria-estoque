"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDailyRevenue } from "../dashboard/actions";

export function DeleteRevenueButton({ storeId, date }: { storeId: string; date: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir esse lançamento de faturamento (todos os canais do dia)?")) return;
        startTransition(async () => {
          await deleteDailyRevenue(storeId, date);
          toast.success("Lançamento excluído.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
