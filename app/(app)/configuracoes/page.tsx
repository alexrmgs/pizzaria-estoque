import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { CltDeductionsForm } from "./clt-deductions-form";

type Bracket = { upTo: number | null; rate: number };

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const { role } = user;

  if (!role.canManageEstoque && !role.canManageUsuarios && !role.canManageFuncionarios) {
    redirect("/meu-ponto");
  }

  type ConfigLink = { href: string; title: string; description: string };

  const estoqueLinks: ConfigLink[] = role.canManageEstoque
    ? [
        {
          href: "/categorias",
          title: "Categorias",
          description: "Organize os ingredientes do estoque por categoria.",
        },
      ]
    : [];

  const rhLinks: ConfigLink[] = role.canManageFuncionarios
    ? [
        {
          href: "/funcionarios",
          title: "Funcionários",
          description: "Cadastro, ponto, vales, bônus/descontos e pagamentos.",
        },
        {
          href: "/pagamentos",
          title: "Pagamentos",
          description: "Feche o pagamento de qualquer funcionário num só lugar.",
        },
        {
          href: "/vales",
          title: "Vales",
          description: "Lançamento rápido de vale para qualquer funcionário.",
        },
        {
          href: "/lojas",
          title: "Lojas",
          description: "Unidades da FB Pizzaria e confirmação de localização no ponto.",
        },
      ]
    : [];

  const sistemaLinks: ConfigLink[] = role.canManageUsuarios
    ? [
        {
          href: "/cargos",
          title: "Cargos",
          description: "Crie cargos e defina permissões de acesso ao sistema.",
        },
        {
          href: "/usuarios",
          title: "Usuários",
          description: "Contas de acesso ao sistema da equipe.",
        },
      ]
    : [];

  const groups = [
    { title: "Gestão de Estoque", links: estoqueLinks },
    { title: "Gestão de RH", links: rhLinks },
    { title: "Sistema", links: sistemaLinks },
  ].filter((group) => group.links.length > 0);

  const settings = role.canManageFuncionarios ? await getAppSettings() : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-neutral-500">Administração do sistema e da equipe.</p>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            {group.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.links.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-500">{link.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {settings && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-lg">Ponto e horas extras</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm
              settings={{
                overtimeMode: settings.overtimeMode,
                dailyExpectedHours: settings.dailyExpectedHours.toString(),
                overtimeRate: settings.overtimeRate.toString(),
              }}
            />
          </CardContent>
        </Card>
      )}

      {settings && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Descontos de carteira assinada</CardTitle>
          </CardHeader>
          <CardContent>
            <CltDeductionsForm
              inssBrackets={settings.inssBrackets as unknown as Bracket[]}
              irrfBrackets={settings.irrfBrackets as unknown as Bracket[]}
              irrfDependentDeduction={settings.irrfDependentDeduction.toString()}
              valeTransporteRate={settings.valeTransporteRate.toString()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
