import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { MadrugadaForm } from "./madrugada-form";
import { MadrugadaEmployeeSection } from "./madrugada-employee-section";

export default async function MadrugadaPage() {
  const user = await requirePermission("canManageFuncionarios");

  const [employees, settings, payments] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getAppSettings(user.companyId),
    prisma.payrollAdjustment.findMany({
      where: { type: "MADRUGADA" },
      orderBy: { date: "desc" },
      take: 300,
      include: { employee: true },
    }),
  ]);

  type EmployeeGroup = {
    employeeId: string;
    employeeName: string;
    pendingTotal: number;
    pendingCount: number;
    entries: {
      id: string;
      date: string;
      amount: number;
      description: string | null;
      paid: boolean;
    }[];
  };
  const employeeGroups: EmployeeGroup[] = [];
  const employeeGroupById = new Map<string, EmployeeGroup>();
  for (const adjustment of payments) {
    let group = employeeGroupById.get(adjustment.employeeId);
    if (!group) {
      group = {
        employeeId: adjustment.employeeId,
        employeeName: adjustment.employee.name,
        pendingTotal: 0,
        pendingCount: 0,
        entries: [],
      };
      employeeGroupById.set(adjustment.employeeId, group);
      employeeGroups.push(group);
    }
    const amount = Number(adjustment.amount);
    const paid = adjustment.paidAt !== null || adjustment.paymentId !== null;
    if (!paid) {
      group.pendingTotal += amount;
      group.pendingCount += 1;
    }
    group.entries.push({
      id: adjustment.id,
      date: adjustment.date.toISOString().slice(0, 10),
      amount,
      description: adjustment.description,
      paid,
    });
  }
  // Quem tem mais pendente aparece primeiro (é quem você provavelmente vai
  // pagar agora); sem pendência, fica por ordem alfabética.
  employeeGroups.sort(
    (a, b) => b.pendingTotal - a.pendingTotal || a.employeeName.localeCompare(b.employeeName),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Madrugada</h1>
        <p className="text-sm text-neutral-500">
          Toda vez que um funcionário fizer um turno extra de madrugada, lance aqui o dia e o
          valor combinado (já vem preenchido com o valor fixo cadastrado, mas dá pra mudar). Isso
          NÃO tem nada a ver com o adicional noturno automático (que já sai sozinho do ponto
          batido) e NÃO entra na folha de pagamento mensal — é um pagamento à parte. A lista abaixo
          é organizada por funcionário: abra o card dele, gere o &quot;Comprovante&quot; (uma
          página só com os dias e o total, pra imprimir ou mandar por WhatsApp) e, depois de
          pagar, aperte &quot;Pagar&quot; pra zerar o pendente. Isso só aparece aqui pra quem
          gerencia — o funcionário não vê nada disso, só o salário normal dele.
        </p>
      </div>

      <MadrugadaForm
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        valorFixo={settings.valorFixoMadrugada.toString()}
      />

      {employeeGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pagamento de madrugada lançado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {employeeGroups.map((group, index) => (
            <MadrugadaEmployeeSection
              key={group.employeeId}
              employeeId={group.employeeId}
              employeeName={group.employeeName}
              entries={group.entries}
              pendingTotal={group.pendingTotal}
              pendingCount={group.pendingCount}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
