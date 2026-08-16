"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setEmployeeActive } from "./actions";
import { TerminationDialog } from "./termination-dialog";

export function DismissEmployeeButton({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (active) {
    return <TerminationDialog employeeId={id} employeeName={name} />;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Reativar "${name}"?`)) return;
        startTransition(async () => {
          try {
            await setEmployeeActive(id, true);
            toast.success(`${name} foi reativado.`);
          } catch {
            toast.error("Não foi possível reativar o funcionário.");
          }
        });
      }}
    >
      Reativar
    </Button>
  );
}
