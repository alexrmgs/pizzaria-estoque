"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Menu } from "lucide-react";

export function CollapsibleSidebar({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({ open: true, ready: false });
  const { open, ready } = state;

  useEffect(() => {
    const saved = localStorage.getItem("sidebarOpen");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ open: saved === null ? true : saved === "1", ready: true });
  }, []);

  function toggle() {
    setState((prev) => {
      const next = !prev.open;
      localStorage.setItem("sidebarOpen", next ? "1" : "0");
      return { ...prev, open: next };
    });
  }

  return (
    <>
      {open && (
        <aside className="relative hidden flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground md:flex md:w-64 print:hidden">
          <button
            type="button"
            onClick={toggle}
            title="Recolher menu"
            className="absolute top-3 right-3 rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          {children}
        </aside>
      )}
      {ready && !open && (
        <div className="hidden shrink-0 border-r bg-white p-2 md:block print:hidden">
          <button
            type="button"
            onClick={toggle}
            title="Abrir menu"
            className="rounded-md border bg-white p-2 shadow-sm hover:bg-neutral-50"
          >
            <Menu className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}
