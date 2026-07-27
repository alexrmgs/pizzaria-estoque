"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Permissions = {
  canManageEstoque: boolean;
  canManageReceitas: boolean;
  canManageUsuarios: boolean;
  canViewRelatorios: boolean;
  canManageFuncionarios: boolean;
};

type NavItem = { href: string; label: string };

function NavLink({ href, label }: NavItem) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
        pathname.startsWith(href)
          ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
          : "text-sidebar-foreground/80",
      )}
    >
      {label}
    </Link>
  );
}

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-sidebar-foreground/40 uppercase">
        {title}
      </p>
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </div>
  );
}

export function NavLinks({ permissions }: { permissions: Permissions }) {
  const estoqueItems: NavItem[] = [
    ...(permissions.canManageEstoque
      ? [
          { href: "/estoque", label: "Estoque" },
          { href: "/lista-compras", label: "Lista de Compras" },
          { href: "/conferencia", label: "Conferência de Estoque" },
          { href: "/producao", label: "Produção" },
          { href: "/movimentacoes", label: "Movimentações" },
        ]
      : []),
    ...(permissions.canManageReceitas ? [{ href: "/receitas", label: "Receitas" }] : []),
    ...(permissions.canViewRelatorios ? [{ href: "/relatorios", label: "Relatórios" }] : []),
  ];

  const rhItems: NavItem[] = permissions.canManageFuncionarios
    ? [
        { href: "/funcionarios", label: "Funcionários" },
        { href: "/pagamentos", label: "Pagamentos" },
        { href: "/vales", label: "Vales" },
        { href: "/lojas", label: "Lojas" },
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

      {hasAdminAccess && (
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-2">
          <NavLink href="/configuracoes" label="Configurações" />
        </div>
      )}
    </nav>
  );
}
