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
import { StoreDialog } from "./store-dialog";
import { DeleteStoreButton } from "./delete-store-button";

export default async function LojasPage() {
  await requirePermission("canManageFuncionarios");

  const stores = await prisma.store.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Lojas</h1>
          <p className="text-sm text-neutral-500">
            Cadastre as unidades da FB Pizzaria para confirmar a localização no ponto.
          </p>
        </div>
        <StoreDialog />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Raio permitido</TableHead>
              <TableHead>Funcionários</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500">
                  Nenhuma loja cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
            {stores.map((store) => (
              <TableRow key={store.id}>
                <TableCell className="font-medium">
                  {store.name}
                  {store.saiposToken && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      SaiPos
                    </span>
                  )}
                  {store.pluggyClientId && (
                    <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                      Pluggy
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-neutral-500">{store.address ?? "—"}</TableCell>
                <TableCell>{store.radiusMeters} m</TableCell>
                <TableCell className="text-neutral-500">{store._count.employees}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <StoreDialog
                      store={{
                        id: store.id,
                        name: store.name,
                        address: store.address,
                        latitude: store.latitude.toString(),
                        longitude: store.longitude.toString(),
                        radiusMeters: store.radiusMeters,
                        saiposToken: store.saiposToken,
                        pluggyClientId: store.pluggyClientId,
                        pluggyClientSecret: store.pluggyClientSecret,
                      }}
                    />
                    <DeleteStoreButton id={store.id} name={store.name} />
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
