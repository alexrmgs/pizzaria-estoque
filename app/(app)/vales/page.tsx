import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { ValeForm } from "./vale-form";
import { ValeEmployeeSection } from "./vale-employee-section";

export default async function ValesPage() {
  await requirePermission("canManageFuncionarios");

  const [employees, advances] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.advance.findMany({
      where: { kind: "VALE" },
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
    vales: {
      id: string;
      date: string;
      amount: number;
      description: string | null;
      paymentId: string | null;
    }[];
  };
  const employeeGroups: EmployeeGroup[] = [];
  const employeeGroupById = new Map<string, EmployeeGroup>();
  for (const advance of advances) {
    let group = employeeGroupById.get(advance.employeeId);
    if (!group) {
      group = {
        employeeId: advance.employeeId,
        employeeName: advance.employee.name,
        pendingTotal: 0,
        pendingCount: 0,
        vales: [],
      };
      employeeGroupById.set(advance.employeeId, group);
      employeeGroups.push(group);
    }
    const amount = Number(advance.amount);
    if (!advance.paymentId) {
      group.pendingTotal += amount;
      group.pendingCount += 1;
    }
    group.vales.push({
      id: advance.id,
      date: advance.date.toISOString().slice(0, 10),
      amount,
      description: advance.description,
      paymentId: advance.paymentId,
    });
  }
  // Quem tem mais pendente aparece primeiro; sem pendência, ordem alfabética.
  employeeGroups.sort(
    (a, b) => b.pendingTotal - a.pendingTotal || a.employeeName.localeCompare(b.employeeName),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Vales</h1>
        <p className="text-sm text-neutral-500">
          Vales (produtos retirados na pizzaria) — lançamento rápido pra qualquer funcionário. O
          adiantamento quinzenal fica em Folha de Pagamento. Lista organizada por funcionário; quem
          tem vale pendente aparece primeiro.
        </p>
      </div>

      <ValeForm employees={employees.map((e) => ({ id: e.id, name: e.name }))} />

      {employeeGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum vale lançado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {employeeGroups.map((group, index) => (
            <ValeEmployeeSection
              key={group.employeeId}
              employeeName={group.employeeName}
              vales={group.vales}
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
