import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";

  const adminRole = await prisma.role.upsert({
    where: { name: "Administrador" },
    update: {},
    create: {
      name: "Administrador",
      canManageEstoque: true,
      canManageReceitas: true,
      canManageUsuarios: true,
      canViewRelatorios: true,
      canManageFuncionarios: true,
    },
  });

  await prisma.role.upsert({
    where: { name: "Equipe" },
    update: {},
    create: { name: "Equipe" },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário admin já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, roleId: adminRole.id },
  });

  console.log(`Usuário admin criado com sucesso:`);
  console.log(`  E-mail: ${email}`);
  console.log(`  Senha:  ${password}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      "  Aviso: senha padrão de exemplo usada (defina SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD no .env para algo seguro e troque depois do primeiro login).",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
