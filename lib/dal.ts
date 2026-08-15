import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { RolePermissions } from "@/types/next-auth";

export const getSession = cache(async () => auth());

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

type PermissionKey = keyof Omit<RolePermissions, "id" | "name">;

export async function requirePermission(key: PermissionKey) {
  const user = await requireUser();
  // Redirects to /meu-ponto (not /dashboard) because /dashboard itself requires
  // a permission now — redirecting there would loop for accounts without it.
  if (!user.role[key]) redirect("/meu-ponto");
  return user;
}

/** Acesso às etiquetas de PEDIDO (atendimento). */
export async function requireEtiquetasAccess() {
  const user = await requireUser();
  if (!user.role.canPrintEtiquetas && !user.role.canManageEstoque) {
    redirect("/meu-ponto");
  }
  return user;
}

/** Acesso às etiquetas de PRODUÇÃO (cozinha). */
export async function requireProducaoAccess() {
  const user = await requireUser();
  if (!user.role.canPrintProducao && !user.role.canManageEstoque) {
    redirect("/meu-ponto");
  }
  return user;
}

/** Impressão pelo navegador serve as duas telas — aceita qualquer acesso de
 * etiqueta. */
export async function requireImpressaoAccess() {
  const user = await requireUser();
  if (!user.role.canPrintEtiquetas && !user.role.canPrintProducao && !user.role.canManageEstoque) {
    redirect("/meu-ponto");
  }
  return user;
}

// E-mails que podem gerenciar OUTRAS empresas (criar empresa nova, etc).
// Isso não dá pra ser uma permissão normal (canX): permissão vive no Role,
// que agora é por empresa — não existe um "canManageEmpresas" dentro de uma
// empresa que faça sentido pra criar empresas por cima dela.
const SUPER_ADMIN_EMAILS = ["alex.rmgs@gmail.com"];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return SUPER_ADMIN_EMAILS.includes(email ?? "");
}

/** Acesso à tela de Empresas (multi-tenant) — só o super admin. */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!isSuperAdminEmail(user.email)) {
    redirect("/meu-ponto");
  }
  return user;
}
