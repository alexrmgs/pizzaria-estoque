"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/dal";

const empresaSchema = z.object({
  companyName: z.string().trim().min(1, "Informe o nome da empresa."),
  adminName: z.string().trim().min(1, "Informe o nome do admin."),
  adminEmail: z.email("Informe um e-mail válido."),
  adminPassword: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

export type CriarEmpresaFormState = { error?: string } | undefined;

// Cria uma empresa nova, totalmente vazia (sem loja/estoque/receita — só o
// necessário pra logar): a empresa, um cargo "Administrador" (todas as
// permissões) e o primeiro usuário admin. Nada é copiado de outra empresa.
export async function criarEmpresa(
  _prevState: CriarEmpresaFormState,
  formData: FormData,
): Promise<CriarEmpresaFormState> {
  await requireSuperAdmin();

  const parsed = empresaSchema.safeParse({
    companyName: formData.get("companyName"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.adminPassword, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: parsed.data.companyName } });
      const role = await tx.role.create({
        data: {
          companyId: company.id,
          name: "Administrador",
          canManageEstoque: true,
          canManageReceitas: true,
          canManageUsuarios: true,
          canViewRelatorios: true,
          canManageFuncionarios: true,
          canPrintEtiquetas: true,
          canPrintProducao: true,
        },
      });
      await tx.user.create({
        data: {
          companyId: company.id,
          roleId: role.id,
          name: parsed.data.adminName,
          email: parsed.data.adminEmail,
          passwordHash,
        },
      });
    });
  } catch {
    return { error: "Já existe um usuário com esse e-mail." };
  }

  revalidatePath("/empresas");
  return {};
}
