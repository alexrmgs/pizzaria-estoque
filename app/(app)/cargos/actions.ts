"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const roleSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cargo."),
  canManageEstoque: z.coerce.boolean(),
  canManageReceitas: z.coerce.boolean(),
  canManageUsuarios: z.coerce.boolean(),
  canViewRelatorios: z.coerce.boolean(),
  canManageFuncionarios: z.coerce.boolean(),
  canPrintEtiquetas: z.coerce.boolean(),
});

export type RoleFormState = { error?: string } | undefined;

function parseRoleForm(formData: FormData) {
  return roleSchema.safeParse({
    name: formData.get("name"),
    canManageEstoque: formData.get("canManageEstoque") === "on",
    canManageReceitas: formData.get("canManageReceitas") === "on",
    canManageUsuarios: formData.get("canManageUsuarios") === "on",
    canViewRelatorios: formData.get("canViewRelatorios") === "on",
    canManageFuncionarios: formData.get("canManageFuncionarios") === "on",
    canPrintEtiquetas: formData.get("canPrintEtiquetas") === "on",
  });
}

export async function createRole(
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  await requirePermission("canManageUsuarios");

  const parsed = parseRoleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.role.create({ data: parsed.data });
  } catch {
    return { error: "Já existe um cargo com esse nome." };
  }

  revalidatePath("/cargos");
  revalidatePath("/usuarios");
}

export async function updateRole(
  id: string,
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  const currentUser = await requirePermission("canManageUsuarios");

  const parsed = parseRoleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (currentUser.role.id === id && !parsed.data.canManageUsuarios) {
    return { error: "Você não pode remover a permissão de gerenciar usuários do seu próprio cargo." };
  }

  try {
    await prisma.role.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Já existe um cargo com esse nome." };
  }

  revalidatePath("/cargos");
  revalidatePath("/usuarios");
}

export async function deleteRole(id: string) {
  const currentUser = await requirePermission("canManageUsuarios");

  if (currentUser.role.id === id) {
    throw new Error("Você não pode excluir o cargo que você mesmo usa.");
  }

  const usersWithRole = await prisma.user.count({ where: { roleId: id } });
  if (usersWithRole > 0) {
    throw new Error("Existem usuários com esse cargo. Mude o cargo deles antes de excluir.");
  }

  await prisma.role.delete({ where: { id } });
  revalidatePath("/cargos");
}
