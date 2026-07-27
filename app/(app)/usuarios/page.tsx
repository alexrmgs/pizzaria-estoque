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
import { UserDialog } from "./user-dialog";
import { RoleSelect } from "./role-select";

export default async function UsuariosPage() {
  const currentUser = await requirePermission("canManageUsuarios");
  const [users, roles] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { role: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-neutral-500">Gerencie as contas da equipe.</p>
        </div>
        <UserDialog roles={roles} />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <RoleSelect
                    userId={user.id}
                    roleId={user.roleId}
                    roles={roles}
                    disabled={user.id === currentUser.id}
                  />
                </TableCell>
                <TableCell className="text-neutral-500">
                  {user.createdAt.toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <UserDialog
                    roles={roles}
                    user={{ id: user.id, name: user.name, email: user.email, roleId: user.roleId }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
