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

/** Acesso às etiquetas: quem gerencia estoque OU a conta dedicada de
 * impressão. */
export async function requireEtiquetasAccess() {
  const user = await requireUser();
  if (!user.role.canPrintEtiquetas && !user.role.canManageEstoque) {
    redirect("/meu-ponto");
  }
  return user;
}
