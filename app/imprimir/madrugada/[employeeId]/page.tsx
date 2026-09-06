import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { todayInBrazil } from "@/lib/payroll";
import { PrintButton } from "@/components/print-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");
const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });

export default async function ComprovanteMadrugadaPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const user = await requirePermission("canManageFuncionarios");
  const { employeeId } = await params;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) notFound();

  const [settings, entries] = await Promise.all([
    getAppSettings(user.companyId),
    prisma.payrollAdjustment.findMany({
      where: { employeeId, type: "MADRUGADA", paymentId: null, paidAt: null },
      orderBy: { date: "asc" },
    }),
  ]);

  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const hoje = todayInBrazil().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8 print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: A4; margin: 12mm; } }",
        }}
      />
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Comprovante de madrugadas pendentes</p>
        <PrintButton />
      </div>

      <div className="border border-black text-[12px]">
        <div className="border-b border-black px-3 py-2">
          <p className="font-bold uppercase">{settings.labelEmpresa || "Empresa"}</p>
          <p className="text-neutral-600">Comprovante de pagamento de madrugada</p>
        </div>

        <div className="border-b border-black px-3 py-2">
          <p className="text-[10px] text-neutral-500">Funcionário</p>
          <p className="font-medium uppercase">{employee.name}</p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black bg-neutral-100">
              <th className="border-r border-black px-2 py-1 text-left font-semibold">Data</th>
              <th className="border-r border-black px-2 py-1 text-left font-semibold">Descrição</th>
              <th className="px-2 py-1 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-3 text-center text-neutral-500">
                  Nenhuma madrugada pendente.
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const iso = entry.date.toISOString().slice(0, 10);
              return (
              <tr key={entry.id} className="border-b border-neutral-300">
                <td className="border-r border-black px-2 py-1">
                  {brDate(iso)} ({weekday(iso)})
                </td>
                <td className="border-r border-black px-2 py-1 text-neutral-600">
                  {entry.description ?? "—"}
                </td>
                <td className="px-2 py-1 text-right">{currency(Number(entry.amount))}</td>
              </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-between border-t border-black px-3 py-2 font-bold">
          <span>Total a receber</span>
          <span>{currency(total)}</span>
        </div>

        <div className="border-t border-black px-3 py-2 text-[10px] text-neutral-500">
          Gerado em {brDate(hoje)}
        </div>
      </div>
    </div>
  );
}
