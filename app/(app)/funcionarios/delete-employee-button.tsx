"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteEmployee } from "./actions";

export function DeleteEmployeeButton({
  id,
  name,
  redirectTo,
}: {
  id: string;
  name: string;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        if (
          !confirm(
            `Excluir "${name}" definitivamente? Isso apaga TODO o histórico dele — ponto, vales, ajustes e pagamentos. Essa ação não pode ser desfeita. Se quiser manter o histórico, use "Demitir".`,
          )
        )
          return;
        startTransition(async () => {
          try {
            await deleteEmployee(id);
            toast.success(`${name} foi excluído.`);
            if (redirectTo) router.push(redirectTo);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
          }
        });
      }}
    >
      Excluir
    </Button>
  );
}
