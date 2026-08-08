import { DefaultSession } from "next-auth";

export interface RolePermissions {
  id: string;
  name: string;
  canManageEstoque: boolean;
  canManageReceitas: boolean;
  canManageUsuarios: boolean;
  canViewRelatorios: boolean;
  canManageFuncionarios: boolean;
  canPrintEtiquetas: boolean;
}

declare module "next-auth" {
  interface User {
    role: RolePermissions;
  }

  interface Session {
    user: {
      id: string;
      role: RolePermissions;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: RolePermissions;
  }
}
