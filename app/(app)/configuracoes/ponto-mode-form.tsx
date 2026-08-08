"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePontoMode } from "./actions";

type Mode = "CELULAR" | "FACIAL";

export function PontoModeForm({ current }: { current: Mode }) {
  const [mode, setMode] = useState<Mode>(current);
  const [isPending, startTransition] = useTransition();

  function choose(next: Mode) {
    if (next === mode) return;
    setMode(next);
    startTransition(async () => {
      const result = await updatePontoMode(next);
      if (result.error) {
        toast.error(result.error);
        setMode(current);
      } else {
        toast.success("Modo de ponto atualizado.");
      }
    });
  }

  const options: { value: Mode; title: string; description: string; icon: string }[] = [
    {
      value: "CELULAR",
      title: "Pelo celular do funcionário",
      description: "Cada um bate o ponto pelo próprio celular, com localização na loja.",
      icon: "📱",
    },
    {
      value: "FACIAL",
      title: "Por reconhecimento facial",
      description: "Um aparelho fixo na loja reconhece o rosto e bate o ponto.",
      icon: "📷",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const selected = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => choose(opt.value)}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"
            }`}
          >
            <span className="text-2xl">{opt.icon}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{opt.title}</span>
              <span className="block text-xs text-neutral-500">{opt.description}</span>
            </span>
            {selected && <span className="text-primary">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
