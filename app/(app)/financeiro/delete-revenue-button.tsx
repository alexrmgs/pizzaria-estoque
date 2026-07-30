"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRevenue } from "../dashboard/actions";

export function DeleteRevenueButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir esse lançamento de faturamento?")) return;
        startTransition(async () => {
          await deleteRevenue(id);
          toast.success("Lançamento excluído.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
