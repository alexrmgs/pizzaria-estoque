"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteHoliday } from "./actions";

export function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir o feriado "${name}"?`)) return;
        startTransition(async () => {
          await deleteHoliday(id);
          toast.success("Feriado excluído.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
