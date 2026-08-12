"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Permissions = {
  canManageEstoque: boolean;
  canManageReceitas: boolean;
  canManageUsuarios: boolean;
  canViewRelatorios: boolean;
  canManageFuncionarios: boolean;
  canPrintEtiquetas: boolean;
  canPrintProducao: boolean;
};

type NavItem = { href: string; label: string };

function NavLink({ href, label, nested }: NavItem & { nested?: boolean }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        nested
          ? active
            ? "bg-primary text-white"
            : "text-white hover:bg-sidebar-accent"
          : active
            ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
            : "text-white hover:bg-sidebar-accent",
      )}
    >
      {label}
    </Link>
  );
}

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-sidebar-foreground/90 uppercase hover:text-white"
      >
        {title}
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="mt-1 mb-2 ml-3 flex flex-col gap-1.5 border-l-2 border-sidebar-border/60 pl-2">
          {items.map((item) => (
            <NavLink key={item.href} {...item} nested />
          ))}
        </div>
      )}
    </div>
  );
}

export function NavLinks({ permissions }: { permissions: Permissions }) {
  const hasManage =
    permissions.canManageEstoque ||
    permissions.canManageReceitas ||
    permissions.canManageUsuarios ||
    permissions.canViewRelatorios ||
    permissions.canManageFuncionarios;

  // Estação de impressão: só imprime etiquetas (pedidos e/ou produção), nada
  // mais. Vê só a(s) tela(s) que tem permissão.
  if (!hasManage && (permissions.canPrintEtiquetas || permissions.canPrintProducao)) {
    return (
      <nav className="flex flex-col gap-3">
        {permissions.canPrintEtiquetas && (
          <NavLink href="/etiquetas" label="Etiquetas — Pedidos" />
        )}
        {permissions.canPrintProducao && (
          <NavLink href="/etiquetas-producao" label="Etiquetas — Produção" />
        )}
      </nav>
    );
  }

  const estoqueItems: NavItem[] = [
    ...(permissions.canManageEstoque
      ? [
          { href: "/estoque", label: "Estoque" },
          { href: "/lista-compras", label: "Lista de Compras" },
          { href: "/conferencia", label: "Conferência de Estoque" },
          { href: "/producao", label: "Produção" },
          { href: "/movimentacoes", label: "Movimentações" },
          { href: "/etiquetas", label: "Etiquetas (Pedidos)" },
          { href: "/etiquetas-producao", label: "Etiquetas (Produção)" },
        ]
      : []),
    ...(permissions.canManageReceitas ? [{ href: "/receitas", label: "Receitas" }] : []),
    ...(permissions.canViewRelatorios ? [{ href: "/relatorios", label: "Relatórios" }] : []),
  ];

  const rhItems: NavItem[] = permissions.canManageFuncionarios
    ? [
        { href: "/funcionarios", label: "Funcionários" },
        { href: "/ponto-equipe", label: "Ponto da Equipe" },
        { href: "/ponto-totem", label: "Ponto por Facial" },
        { href: "/escalas", label: "Escalas" },
        { href: "/pagamentos", label: "Pagamentos" },
        { href: "/vales", label: "Vales" },
      ]
    : [];

  const financeiroItems: NavItem[] = permissions.canViewRelatorios
    ? [
        { href: "/caixa", label: "Financeiro" },
        { href: "/financeiro", label: "Faturamento" },
        { href: "/precificacao", label: "Precificação" },
        { href: "/bancos", label: "Bancos" },
      ]
    : [];

  const hasAdminAccess =
    permissions.canManageEstoque || permissions.canManageUsuarios || permissions.canManageFuncionarios;

  return (
    <nav className="flex flex-col gap-3">
      {(permissions.canManageEstoque || permissions.canManageFuncionarios) && (
        <NavLink href="/dashboard" label="Dashboard" />
      )}
      <NavLink href="/meu-ponto" label="Meu Ponto" />

      <NavGroup title="Gestão de Estoque" items={estoqueItems} />
      <NavGroup title="Gestão de RH" items={rhItems} />
      <NavGroup title="Financeiro" items={financeiroItems} />

      {hasAdminAccess && (
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-2">
          <NavLink href="/configuracoes" label="Configurações" />
        </div>
      )}
    </nav>
  );
}
