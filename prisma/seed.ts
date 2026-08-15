import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const companyName = process.env.SEED_COMPANY_NAME ?? "Minha Empresa";

  // Empresa (tenant) — pega a primeira que existir ou cria uma nova pra
  // ambiente de dev do zero.
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({ data: { name: companyName } });
  }

  // `update` também fixa as permissões (não só `create`): o cargo "Administrador"
  // pode já existir de uma migration antiga anterior a alguma permissão nova
  // (ex: canManageFuncionarios foi adicionada depois, com default false), e
  // nesse caso um upsert com update vazio deixaria o cargo incompleto.
  const adminPermissions = {
    canManageEstoque: true,
    canManageReceitas: true,
    canManageUsuarios: true,
    canViewRelatorios: true,
    canManageFuncionarios: true,
  };
  const adminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Administrador" } },
    update: adminPermissions,
    create: { companyId: company.id, name: "Administrador", ...adminPermissions },
  });

  await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Equipe" } },
    update: {},
    create: { companyId: company.id, name: "Equipe" },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário admin já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, roleId: adminRole.id, companyId: company.id },
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
