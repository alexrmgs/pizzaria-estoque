"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrScanner } from "./qr-scanner";

// Só liga a câmera quando pedido — não faz sentido pedir permissão de câmera
// toda vez que alguém abre Movimentações só pra lançar uma saída manual.
export function QrBaixaPanel() {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <p className="text-sm text-neutral-500">
            Tem etiqueta com QR? Escaneia e a saída sai sozinha, com o peso certo.
          </p>
          <Button variant="outline" onClick={() => setAberto(true)}>
            Escanear QR
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Escanear QR (dar baixa)</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </CardHeader>
      <CardContent>
        <QrScanner />
      </CardContent>
    </Card>
  );
}
