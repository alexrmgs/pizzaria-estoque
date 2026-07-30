import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddHolidayForm } from "./add-holiday-form";
import { DeleteHolidayButton } from "./delete-holiday-button";

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function FeriadosPage() {
  await requirePermission("canManageFuncionarios");

  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Feriados</h1>
        <p className="text-sm text-neutral-500">
          Cadastre os feriados nacionais, estaduais e municipais que valem pra sua equipe — usados
          pra calcular corretamente o desconto de falta (a falta também derruba o pagamento do
          feriado se ele cair na mesma semana da falta, conforme a Lei 605/49).
        </p>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <AddHolidayForm />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-neutral-500">
                  Nenhum feriado cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell className="font-medium">{formatDate(holiday.date)}</TableCell>
                <TableCell className="text-neutral-500">{holiday.name}</TableCell>
                <TableCell className="text-right">
                  <DeleteHolidayButton id={holiday.id} name={holiday.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
