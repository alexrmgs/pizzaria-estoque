import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";

export default async function Home() {
  const session = await getSession();
  const role = session?.user?.role;

  // Conta dedicada de impressão cai direto na tela de etiquetas.
  if (
    role?.canPrintEtiquetas &&
    !role.canManageEstoque &&
    !role.canManageFuncionarios &&
    !role.canManageReceitas &&
    !role.canManageUsuarios &&
    !role.canViewRelatorios
  ) {
    redirect("/etiquetas");
  }

  redirect("/dashboard");
}
