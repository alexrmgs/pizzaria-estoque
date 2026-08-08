"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TotemKiosk } from "./totem-kiosk";
import { FaceEnrollment } from "./face-enrollment";

type Employee = { id: string; name: string; hasFace: boolean };

// Alterna entre bater ponto e cadastrar — renderiza só um por vez pra não
// abrir duas câmeras ao mesmo tempo.
export function TotemTabs({ employees }: { employees: Employee[] }) {
  const [mode, setMode] = useState<"bater" | "cadastrar">("bater");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "bater" ? "default" : "outline"}
          onClick={() => setMode("bater")}
        >
          Bater Ponto
        </Button>
        <Button
          size="sm"
          variant={mode === "cadastrar" ? "default" : "outline"}
          onClick={() => setMode("cadastrar")}
        >
          Cadastrar Rostos
        </Button>
      </div>

      {mode === "bater" ? <TotemKiosk /> : <FaceEnrollment employees={employees} />}
    </div>
  );
}
