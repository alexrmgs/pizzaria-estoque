"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { atualizarTudo } from "./actions";

export function AtualizarButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function atualizar() {
    setLoading(true);
    const r = await atualizarTudo();
    setLoading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(
      "Pedi pra Pluggy atualizar. As movimentações novas aparecem em alguns instantes — atualize a página em ~1 min.",
    );
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={atualizar} disabled={loading} className="h-10">
      <RefreshCw className={"mr-1 size-4 " + (loading ? "animate-spin" : "")} />
      {loading ? "Atualizando…" : "Atualizar agora"}
    </Button>
  );
}
