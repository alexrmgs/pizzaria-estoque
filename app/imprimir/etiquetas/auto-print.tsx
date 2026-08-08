"use client";

import { useEffect } from "react";

/** Dispara a impressão sozinho ao abrir a página, pra ser rápido no balcão. */
export function AutoPrint() {
  useEffect(() => {
    const timeout = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timeout);
  }, []);
  return null;
}
