"use client";

import { Button } from "@/components/ui/button";

type Item = {
  name: string;
  unit: string;
  suggestedQty: number;
};

function buildMessage(items: Item[]) {
  const lines = [
    "*Lista de Compras — FB Pizzaria & Esfiharia*",
    new Date().toLocaleDateString("pt-BR"),
    "",
    ...items.map((item) => `• ${item.name}: ${item.suggestedQty} ${item.unit}`),
  ];
  return lines.join("\n");
}

export function WhatsAppShareButton({ items }: { items: Item[] }) {
  function handleClick() {
    const message = buildMessage(items);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} className="print:hidden">
      Enviar por WhatsApp
    </Button>
  );
}
