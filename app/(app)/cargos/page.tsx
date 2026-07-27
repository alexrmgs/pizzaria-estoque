import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleDialog } from "./role-dialog";
import { DeleteRoleButton } from "./delete-role-button";

export default async function CargosPage() {
  await requirePermission("canManageUsuarios");

  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cargos</h1>
          <p className="text-sm text-neutral-500">
            Crie cargos e defina o que cada um pode acessar no sistema.
          </p>
        </div>
        <RoleDialog />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {role.canManageEstoque && <Badge variant="secondary">Estoque</Badge>}
                    {role.canManageReceitas && <Badge variant="secondary">Receitas</Badge>}
                    {role.canViewRelatorios && <Badge variant="secondary">Relatórios</Badge>}
                    {role.canManageUsuarios && <Badge variant="secondary">Usuários</Badge>}
                    {role.canManageFuncionarios && (
                      <Badge variant="secondary">Funcionários</Badge>
                    )}
                    {!role.canManageEstoque &&
                      !role.canManageReceitas &&
                      !role.canViewRelatorios &&
                      !role.canManageUsuarios &&
                      !role.canManageFuncionarios && (
                        <span className="text-sm text-neutral-500">Nenhuma</span>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-neutral-500">{role._count.users}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <RoleDialog role={role} />
                    <DeleteRoleButton id={role.id} name={role.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
