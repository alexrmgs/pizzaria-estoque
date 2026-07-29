import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsForm } from "./settings-form";
import { CltDeductionsForm } from "./clt-deductions-form";

type Bracket = { upTo: number | null; rate: number };
type ConfigLink = { href: string; title: string; description: string };

function LinkGrid({ links }: { links: ConfigLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
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
  );
}

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const { role } = user;

  if (!role.canManageEstoque && !role.canManageUsuarios && !role.canManageFuncionarios) {
    redirect("/meu-ponto");
  }

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

  const settings = role.canManageFuncionarios ? await getAppSettings() : null;

  const tabs = [
    { value: "estoque", label: "Estoque", visible: role.canManageEstoque },
    { value: "rh", label: "Gestão de RH", visible: role.canManageFuncionarios },
    { value: "sistema", label: "Sistema", visible: role.canManageUsuarios },
  ].filter((t) => t.visible);
  const defaultTab = tabs[0]?.value ?? "estoque";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-neutral-500">Administração do sistema e da equipe.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {role.canManageEstoque && (
          <TabsContent value="estoque" className="flex flex-col gap-4 pt-4">
            <LinkGrid links={estoqueLinks} />
          </TabsContent>
        )}

        {role.canManageFuncionarios && (
          <TabsContent value="rh" className="flex flex-col gap-6 pt-4">
            <LinkGrid links={rhLinks} />

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
          </TabsContent>
        )}

        {role.canManageUsuarios && (
          <TabsContent value="sistema" className="flex flex-col gap-4 pt-4">
            <LinkGrid links={sistemaLinks} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
