"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteIngredient, setIngredientActive } from "./actions";

export function DeleteIngredientButton({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!active) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Reativar "${name}"?`)) return;
          startTransition(async () => {
            await setIngredientActive(id, true);
            toast.success(`${name} foi reativado.`);
          });
        }}
      >
        Reativar
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir o ingrediente "${name}"?`)) return;
        startTransition(async () => {
          const result = await deleteIngredient(id);
          if (result.blocked) {
            if (
              confirm(
                `"${name}" já tem movimentações ou receitas vinculadas e não pode ser excluído (perderia o histórico). Quer arquivar em vez disso? Ele some das listas de compra/produção/receitas, mas o histórico continua salvo — dá pra reativar depois.`,
              )
            ) {
              await setIngredientActive(id, false);
              toast.success(`${name} foi arquivado.`);
            }
            return;
          }
          toast.success("Ingrediente excluído.");
        });
      }}
    >
      Excluir
    </Button>
  );
}
