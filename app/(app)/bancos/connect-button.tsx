"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { novoConnectToken, salvarConexao } from "./actions";

// O widget da Pluggy usa `window` no carregamento — só pode rodar no navegador,
// nunca no servidor (senão a página Bancos quebra com "window is not defined").
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false },
);

export function ConnectButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function abrir() {
    setLoading(true);
    const result = await novoConnectToken(storeId);
    setLoading(false);
    if (result.error || !result.token) {
      toast.error(result.error ?? "Não foi possível iniciar.");
      return;
    }
    setToken(result.token);
    setOpen(true);
  }

  async function handleSuccess(itemData: { item: { id: string } }) {
    const itemId = itemData?.item?.id;
    if (!itemId) return;
    const result = await salvarConexao(itemId, storeId);
    setOpen(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Banco conectado ✅");
    router.refresh();
  }

  return (
    <>
      <Button onClick={abrir} disabled={loading} className="h-10">
        <Landmark className="mr-1 size-4" />
        {loading ? "Abrindo…" : "Conectar banco"}
      </Button>
      {open && token && (
        <PluggyConnect
          connectToken={token}
          onSuccess={handleSuccess}
          onClose={() => setOpen(false)}
          onError={(err: { message?: string }) => {
            toast.error(err?.message ?? "Erro ao conectar o banco.");
          }}
        />
      )}
    </>
  );
}
