"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sincronizarRecebidas } from "./actions";

export function PuxarRecebidas() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function puxar() {
    setLoading(true);
    const r = await sincronizarRecebidas();
    setLoading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    const novas = r.novas ?? 0;
    const semXml = r.semXml ?? 0;
    if (novas === 0 && semXml === 0) {
      toast.info("Nenhuma nota nova. A Focus busca na SEFAZ de tempos em tempos.");
    } else {
      toast.success(
        `${novas} nota(s) importada(s)` + (semXml > 0 ? ` · ${semXml} sem XML ainda` : "") + " ✅",
      );
    }
    router.refresh();
  }

  return (
    <Button onClick={puxar} disabled={loading} variant="outline" className="h-10">
      <RefreshCw className={"mr-1 size-4 " + (loading ? "animate-spin" : "")} />
      {loading ? "Puxando…" : "Puxar recebidas"}
    </Button>
  );
}
