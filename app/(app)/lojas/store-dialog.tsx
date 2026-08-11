"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStore, updateStore } from "./actions";

type Store = {
  id: string;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  saiposToken: string | null;
};

export function StoreDialog({ store }: { store?: Store }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [latitude, setLatitude] = useState(store?.latitude ?? "");
  const [longitude, setLongitude] = useState(store?.longitude ?? "");
  const [locating, setLocating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = store
        ? await updateStore(store.id, undefined, formData)
        : await createStore(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta localização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setLocating(false);
        toast.success("Localização capturada. Confira e salve.");
      },
      () => {
        setLocating(false);
        toast.error("Não foi possível obter sua localização. Permita o acesso e tente de novo.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger
        render={
          <Button variant={store ? "outline" : "default"} size="sm">
            {store ? "Editar" : "+ Nova loja"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{store ? "Editar loja" : "Nova loja"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome da loja</Label>
            <Input id="name" name="name" defaultValue={store?.name} placeholder="Ex: FB Eusébio" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" name="address" defaultValue={store?.address ?? ""} placeholder="Rua, número, bairro" />
          </div>

          <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Obtendo localização..." : "📍 Usar minha localização atual"}
          </Button>
          <p className="-mt-2 text-xs text-muted-foreground">
            Abra isso no celular estando dentro da loja pra marcar a posição certa.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="radiusMeters">Raio permitido (metros)</Label>
            <Input
              id="radiusMeters"
              name="radiusMeters"
              type="number"
              step="1"
              min="10"
              defaultValue={store?.radiusMeters ?? 150}
              required
            />
            <p className="text-xs text-muted-foreground">
              Distância máxima da loja pra permitir bater o ponto.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="saiposToken">Token da API de Dados SaiPos (opcional)</Label>
            <Input
              id="saiposToken"
              name="saiposToken"
              defaultValue={store?.saiposToken ?? ""}
              placeholder="Cole aqui o token dessa loja (sem o 'Bearer ')"
            />
            <p className="text-xs text-muted-foreground">
              Com o token, dá pra puxar o faturamento dessa loja automático no Financeiro.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
