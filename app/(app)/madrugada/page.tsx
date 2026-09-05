import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { MadrugadaForm } from "./madrugada-form";
import { MadrugadaMonthSection } from "./madrugada-month-section";

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

  type MonthGroup = {
    key: string;
    label: string;
    totalAmount: number;
    pendingAmount: number;
    payments: {
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
  for (const adjustment of payments) {
    const key = `${adjustment.date.getUTCFullYear()}-${String(adjustment.date.getUTCMonth() + 1).padStart(2, "0")}`;
    let group = monthGroupByKey.get(key);
    if (!group) {
      const label = adjustment.date.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key, label, totalAmount: 0, pendingAmount: 0, payments: [] };
      monthGroupByKey.set(key, group);
      monthGroups.push(group);
    }
    const amount = Number(adjustment.amount);
    group.totalAmount += amount;
    if (!adjustment.paymentId) group.pendingAmount += amount;
    group.payments.push({
      id: adjustment.id,
      employeeName: adjustment.employee.name,
      date: adjustment.date.toISOString().slice(0, 10),
      amount,
      description: adjustment.description,
      paymentId: adjustment.paymentId,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Madrugada</h1>
        <p className="text-sm text-neutral-500">
          Pagamento fixo pra quem faz extra na madrugada — separado do adicional noturno
          automático, entra no fechamento do pagamento do mês do funcionário.
        </p>
      </div>

      <MadrugadaForm
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        valorFixo={settings.valorFixoMadrugada.toString()}
      />

      {monthGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pagamento de madrugada lançado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {monthGroups.map((group, index) => (
            <MadrugadaMonthSection
              key={group.key}
              monthLabel={group.label}
              payments={group.payments}
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
