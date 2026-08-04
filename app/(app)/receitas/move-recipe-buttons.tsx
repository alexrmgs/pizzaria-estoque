"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveRecipe } from "./actions";

export function MoveRecipeButtons({
  id,
  disableUp,
  disableDown,
}: {
  id: string;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={isPending || disableUp}
        onClick={() => startTransition(() => moveRecipe(id, "up"))}
        aria-label="Mover receita pra cima"
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={isPending || disableDown}
        onClick={() => startTransition(() => moveRecipe(id, "down"))}
        aria-label="Mover receita pra baixo"
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}
