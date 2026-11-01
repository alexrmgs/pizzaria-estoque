"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clockIn, clockOut, toggleBreak } from "./actions";

function getCoords(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export function ClockButton({
  isOpen,
  hasStore,
  intervalo = "NAO_FEZ",
}: {
  isOpen: boolean;
  hasStore: boolean;
  intervalo?: "NAO_FEZ" | "EM_INTERVALO" | "FEITO";
}) {
  const [isPending, startTransition] = useTransition();

  const emIntervalo = isOpen && intervalo === "EM_INTERVALO";

  function handleClick(acao: "ponto" | "intervalo") {
    startTransition(async () => {
      const coords = await getCoords();
      if (hasStore && !coords) {
        toast.error(
          "Não conseguimos acessar sua localização. Permita o acesso à localização do navegador e tente de novo.",
        );
        return;
      }
      try {
        if (acao === "intervalo") {
          await toggleBreak(coords);
          toast.success(emIntervalo ? "Volta do intervalo registrada." : "Intervalo registrado.");
        } else if (isOpen) {
          await clockOut(coords);
          toast.success("Saída registrada.");
        } else {
          await clockIn(coords);
          toast.success("Entrada registrada.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível registrar.");
      }
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {isOpen && intervalo !== "FEITO" && (
        <Button
          size="lg"
          variant="outline"
          disabled={isPending}
          onClick={() => handleClick("intervalo")}
          className="h-14 w-full text-base sm:w-64"
        >
          {isPending ? "Registrando..." : emIntervalo ? "Voltar do intervalo" : "Sair pro intervalo"}
        </Button>
      )}
      {!emIntervalo && (
        <Button
          size="lg"
          variant={isOpen ? "destructive" : "default"}
          disabled={isPending}
          onClick={() => handleClick("ponto")}
          className="h-14 w-full text-base sm:w-64"
        >
          {isPending ? "Registrando..." : isOpen ? "Bater saída" : "Bater entrada"}
        </Button>
      )}
    </div>
  );
}
