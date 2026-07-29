"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";

type Permissions = {
  canManageEstoque: boolean;
  canManageReceitas: boolean;
  canManageUsuarios: boolean;
  canViewRelatorios: boolean;
  canManageFuncionarios: boolean;
};

export function MobileSidebar({
  permissions,
  userName,
  roleName,
}: {
  permissions: Permissions;
  userName: string;
  roleName: string;
}) {
  const [open, setOpen] = useState(false);

  // Fecha o menu automaticamente ao navegar pra outra página.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between gap-2 bg-sidebar p-4 text-sidebar-foreground print:hidden">
        <div className="flex items-center gap-2 px-1">
          <Image src="/logo.png" alt="FB Pizzaria & Esfiharia" width={32} height={31} priority />
          <span className="text-sm font-bold text-white">FB Pizzaria</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-sidebar-accent hover:text-white"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-1">
                <Image
                  src="/logo.png"
                  alt="FB Pizzaria & Esfiharia"
                  width={40}
                  height={39}
                  priority
                />
                <div>
                  <p className="text-sm leading-tight font-bold text-white">FB Pizzaria</p>
                  <p className="text-[11px] leading-tight text-sidebar-foreground/80">
                    Pizzaria &amp; Esfiharia
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-sidebar-accent hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </Button>
            </div>

            <NavLinks permissions={permissions} />

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border pt-4">
              <div className="text-sm">
                <p className="font-medium text-white">{userName}</p>
                <p className="text-sidebar-foreground/80">{roleName}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
