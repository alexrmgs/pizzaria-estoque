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
  canPrintProducao: boolean;
}

declare module "next-auth" {
  interface User {
    role: RolePermissions;
    companyId: string;
    companyName: string;
  }

  interface Session {
    user: {
      id: string;
      role: RolePermissions;
      companyId: string;
      companyName: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: RolePermissions;
    companyId?: string;
    companyName?: string;
  }
}
