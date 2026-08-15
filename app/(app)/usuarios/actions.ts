"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";

/** Normaliza pro formato que a WhatsApp Cloud API manda no campo "from" dos
 * webhooks — só dígitos, com código do país, sem +/espaços/traços. */
function normalizeWhatsappPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  roleId: z.string().trim().min(1, "Selecione um cargo."),
  whatsappPhone: z.string().trim().optional(),
});

export type UserFormState = { error?: string } | undefined;

export async function createUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const currentUser = await requirePermission("canManageUsuarios");

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
    whatsappPhone: formData.get("whatsappPhone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, companyId: currentUser.companyId },
  });
  if (!role) return { error: "Cargo inválido." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const whatsappPhone = parsed.data.whatsappPhone
    ? normalizeWhatsappPhone(parsed.data.whatsappPhone)
    : null;

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        roleId: parsed.data.roleId,
        whatsappPhone,
        companyId: currentUser.companyId,
      },
    });
  } catch {
    return { error: "Já existe um usuário com esse e-mail ou WhatsApp." };
  }

  revalidatePath("/usuarios");
}

export async function updateUserRole(id: string, roleId: string) {
  const currentUser = await requirePermission("canManageUsuarios");

  if (currentUser.id === id) {
    throw new Error("Você não pode alterar seu próprio cargo.");
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, companyId: currentUser.companyId },
  });
  if (!role) throw new Error("Cargo inválido.");

  await prisma.user.updateMany({
    where: { id, companyId: currentUser.companyId },
    data: { roleId },
  });
  revalidatePath("/usuarios");
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").nullable(),
  roleId: z.string().trim().min(1, "Selecione um cargo."),
  whatsappPhone: z.string().trim().optional(),
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
    whatsappPhone: formData.get("whatsappPhone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (currentUser.id === id && parsed.data.roleId !== currentUser.role.id) {
    return { error: "Você não pode alterar seu próprio cargo." };
  }

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, companyId: currentUser.companyId },
  });
  if (!role) return { error: "Cargo inválido." };

  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 10)
    : undefined;
  const whatsappPhone = parsed.data.whatsappPhone
    ? normalizeWhatsappPhone(parsed.data.whatsappPhone)
    : null;

  try {
    const result = await prisma.user.updateMany({
      where: { id, companyId: currentUser.companyId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        roleId: parsed.data.roleId,
        whatsappPhone,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    if (result.count === 0) return { error: "Usuário não encontrado." };
  } catch {
    return { error: "Já existe um usuário com esse e-mail ou WhatsApp." };
  }

  revalidatePath("/usuarios");
}

export async function deleteUser(id: string) {
  const currentUser = await requirePermission("canManageUsuarios");

  if (currentUser.id === id) {
    throw new Error("Você não pode excluir a própria conta.");
  }

  try {
    const result = await prisma.user.deleteMany({ where: { id, companyId: currentUser.companyId } });
    if (result.count === 0) throw new Error("not found");
  } catch {
    throw new Error(
      "Esse usuário já tem lançamentos vinculados (movimentações, pagamentos, vales) ou está ligado a um cadastro de funcionário, e não pode ser excluído.",
    );
  }

  revalidatePath("/usuarios");
  revalidatePath("/funcionarios");
}
