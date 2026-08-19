import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { ValeForm } from "./vale-form";
import { ValeMonthSection } from "./vale-month-section";

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

  type MonthGroup = {
    key: string;
    label: string;
    totalAmount: number;
    pendingAmount: number;
    advances: {
      id: string;
      employeeName: string;
      date: string;
      amount: number;
      description: string | null;
      paymentId: string | null;
    }[];
  };
  const monthGroups: MonthGroup[] = [];
  const monthGroupByKey = new Map<string, MonthGroup>();
  for (const advance of advances) {
    const key = `${advance.date.getUTCFullYear()}-${String(advance.date.getUTCMonth() + 1).padStart(2, "0")}`;
    let group = monthGroupByKey.get(key);
    if (!group) {
      const label = advance.date.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key, label, totalAmount: 0, pendingAmount: 0, advances: [] };
      monthGroupByKey.set(key, group);
      monthGroups.push(group);
    }
    const amount = Number(advance.amount);
    group.totalAmount += amount;
    if (!advance.paymentId) group.pendingAmount += amount;
    group.advances.push({
      id: advance.id,
      employeeName: advance.employee.name,
      date: advance.date.toISOString().slice(0, 10),
      amount,
      description: advance.description,
      paymentId: advance.paymentId,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Vales</h1>
        <p className="text-sm text-neutral-500">
          Vale-comida — lançamento rápido pra qualquer funcionário. O adiantamento quinzenal fica
          em Folha de Pagamento.
        </p>
      </div>

      <ValeForm employees={employees.map((e) => ({ id: e.id, name: e.name }))} />

      {monthGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum vale lançado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {monthGroups.map((group, index) => (
            <ValeMonthSection
              key={group.key}
              monthLabel={group.label}
              advances={group.advances}
              totalAmount={group.totalAmount}
              pendingAmount={group.pendingAmount}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
