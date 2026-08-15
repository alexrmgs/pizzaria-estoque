import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RolePermissions } from "@/types/next-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Necessário fora da Vercel (ex: Hostinger) — sem isso o Auth.js rejeita o
  // host da requisição e mostra o erro genérico "problema de configuração
  // do servidor" em qualquer tentativa de login.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true, company: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          companyName: user.company.name,
          role: {
            id: user.role.id,
            name: user.role.name,
            canManageEstoque: user.role.canManageEstoque,
            canManageReceitas: user.role.canManageReceitas,
            canManageUsuarios: user.role.canManageUsuarios,
            canViewRelatorios: user.role.canViewRelatorios,
            canManageFuncionarios: user.role.canManageFuncionarios,
            canPrintEtiquetas: user.role.canPrintEtiquetas,
            canPrintProducao: user.role.canPrintProducao,
          },
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as RolePermissions;
        session.user.companyId = token.companyId as string;
        session.user.companyName = token.companyName as string;
      }
      return session;
    },
  },
});
