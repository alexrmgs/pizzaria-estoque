"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Settings, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function PdvNav({ storeId }: { storeId: string }) {
  const pathname = usePathname();
  const base = `/pdv/${storeId}`;
  const itens = [
    { href: base, label: "Pedidos", icon: LayoutGrid, ativo: pathname === base },
    { href: `${base}/nova`, label: "Nova venda", icon: Plus, ativo: pathname.startsWith(`${base}/nova`) },
    { href: `${base}/caixa`, label: "Caixa", icon: Wallet, ativo: pathname.startsWith(`${base}/caixa`) },
    { href: `${base}/clientes`, label: "Clientes", icon: Users, ativo: pathname.startsWith(`${base}/clientes`) },
    { href: `${base}/gestao`, label: "Gestão", icon: Settings, ativo: pathname.startsWith(`${base}/gestao`) },
  ];
  return (
    <nav aria-label="PDV" className="flex items-center gap-1">
      {itens.map(({ href, label, icon: Icon, ativo }) => (
        <Link
          key={href}
          href={href}
          aria-current={ativo ? "page" : undefined}
          className={cn(
            "flex h-11 items-center gap-2 rounded-pdv-sm px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent",
            ativo ? "bg-pdv-raised text-pdv-accent" : "text-pdv-muted hover:text-pdv-text"
          )}
        >
          <Icon className="size-5" aria-hidden />
          <span className="hidden md:inline">{label}</span>
          <span className="sr-only md:hidden">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
