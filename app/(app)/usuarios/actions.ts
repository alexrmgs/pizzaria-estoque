"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  roleId: z.string().trim().min(1, "Selecione um cargo."),
});

export type UserFormState = { error?: string } | undefined;

export async function createUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requirePermission("canManageUsuarios");

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        roleId: parsed.data.roleId,
      },
    });
  } catch {
    return { error: "Já existe um usuário com esse e-mail." };
  }

  revalidatePath("/usuarios");
}

export async function updateUserRole(id: string, roleId: string) {
  const currentUser = await requirePermission("canManageUsuarios");

  if (currentUser.id === id) {
    throw new Error("Você não pode alterar seu próprio cargo.");
  }

  await prisma.user.update({ where: { id }, data: { roleId } });
  revalidatePath("/usuarios");
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").nullable(),
  roleId: z.string().trim().min(1, "Selecione um cargo."),
});

export async function updateUser(
  id: string,
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const currentUser = await requirePermission("canManageUsuarios");

  const passwordRaw = formData.get("password");
  const password = typeof passwordRaw === "string" && passwordRaw.trim() !== "" ? passwordRaw : null;

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password,
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (currentUser.id === id && parsed.data.roleId !== currentUser.role.id) {
    return { error: "Você não pode alterar seu próprio cargo." };
  }

  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 10)
    : undefined;

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        roleId: parsed.data.roleId,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  } catch {
    return { error: "Já existe um usuário com esse e-mail." };
  }

  revalidatePath("/usuarios");
}
