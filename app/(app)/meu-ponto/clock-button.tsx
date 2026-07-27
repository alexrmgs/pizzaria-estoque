"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clockIn, clockOut } from "./actions";

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

export function ClockButton({ isOpen, hasStore }: { isOpen: boolean; hasStore: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const coords = await getCoords();
      if (hasStore && !coords) {
        toast.error(
          "Não conseguimos acessar sua localização. Permita o acesso à localização do navegador e tente de novo.",
        );
        return;
      }
      try {
        if (isOpen) {
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
    <Button
      size="lg"
      variant={isOpen ? "destructive" : "default"}
      disabled={isPending}
      onClick={handleClick}
      className="h-14 w-full text-base sm:w-64"
    >
      {isPending ? "Registrando..." : isOpen ? "Bater saída" : "Bater entrada"}
    </Button>
  );
}
