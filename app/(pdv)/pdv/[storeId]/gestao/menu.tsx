"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, BookOpen, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

// Menu da Gestão: onde se monta o que o PDV vende. Opcionais, formas de
// pagamento e status entram aqui depois.
export function GestaoMenu({ storeId }: { storeId: string }) {
  const pathname = usePathname();
  const base = `/pdv/${storeId}/gestao`;
  const itens = [
    { href: `${base}/produtos`, label: "Produtos mãe", desc: "o que a casa produz", icon: Boxes },
    { href: `${base}/cardapios`, label: "Cardápios", desc: "categorias, itens e preços", icon: BookOpen },
    { href: `${base}/entrega`, label: "Taxas de entrega", desc: "faixas por km", icon: Bike },
  ];
  return (
    <nav aria-label="Gestão" className="flex shrink-0 gap-2 overflow-x-auto md:w-56 md:flex-col">
      <p className="hidden px-2 font-pdv-display text-xs font-extrabold tracking-[.2em] text-pdv-accent uppercase md:block">Gestão</p>
      {itens.map(({ href, label, desc, icon: Icon }) => {
        const ativo = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-pdv-md px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent",
              ativo ? "bg-pdv-raised text-pdv-accent" : "text-pdv-muted hover:bg-pdv-surface hover:text-pdv-text"
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="hidden text-xs text-pdv-muted md:block">{desc}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
