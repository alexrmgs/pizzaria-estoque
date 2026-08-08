"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reimprimirEtiqueta } from "./actions";

export function ReimprimirButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await reimprimirEtiqueta(id);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Reenviado pra impressora ✅");
            router.refresh();
          }
        });
      }}
    >
      Reimprimir
    </Button>
  );
}
