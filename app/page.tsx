import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";

export default async function Home() {
  const session = await getSession();
  const role = session?.user?.role;

  // Conta dedicada de impressão cai direto na sua tela de etiquetas.
  const hasManage =
    role?.canManageEstoque ||
    role?.canManageFuncionarios ||
    role?.canManageReceitas ||
    role?.canManageUsuarios ||
    role?.canViewRelatorios;

  if (!hasManage && role?.canPrintEtiquetas) redirect("/etiquetas");
  if (!hasManage && role?.canPrintProducao) redirect("/etiquetas-producao");

  redirect("/dashboard");
}
