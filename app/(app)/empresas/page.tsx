import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyDialog } from "./company-dialog";

function formatDateTime(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function EmpresasPage() {
  await requireSuperAdmin();

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stores: true, users: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Empresas</h1>
          <p className="text-sm text-neutral-500">
            Cada empresa é um cliente isolado do sistema — dados e login separados.
          </p>
        </div>
        <CompanyDialog />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Lojas</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-neutral-500">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            )}
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-neutral-500">{c._count.stores}</TableCell>
                <TableCell className="text-neutral-500">{c._count.users}</TableCell>
                <TableCell className="text-neutral-500">{formatDateTime(c.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
