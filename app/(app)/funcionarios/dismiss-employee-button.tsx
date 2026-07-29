"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setEmployeeActive } from "./actions";

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
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              `Demitir "${name}"? Ele deixa de aparecer em Pagamentos e Vales, mas o histórico dele fica salvo.`,
            )
          )
            return;
          startTransition(async () => {
            try {
              await setEmployeeActive(id, false);
              toast.success(`${name} foi marcado como demitido.`);
            } catch {
              toast.error("Não foi possível demitir o funcionário.");
            }
          });
        }}
      >
        Demitir
      </Button>
    );
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
