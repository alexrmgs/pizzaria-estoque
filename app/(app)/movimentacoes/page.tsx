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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementForm } from "./movement-form";

type Movement = {
  id: string;
  createdAt: Date;
  quantity: unknown;
  reason: string | null;
  ingredient: { name: string; unit: string };
  user: { name: string };
};

function MovementsTable({ movements }: { movements: Movement[] }) {
  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead>Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-neutral-500">
                Nenhuma movimentação registrada ainda.
              </TableCell>
            </TableRow>
          )}
          {movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell>{movement.createdAt.toLocaleString("pt-BR")}</TableCell>
              <TableCell className="font-medium">{movement.ingredient.name}</TableCell>
              <TableCell>
                {String(movement.quantity)} {movement.ingredient.unit}
              </TableCell>
              <TableCell>{movement.user.name}</TableCell>
              <TableCell className="text-neutral-500">{movement.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function MovimentacoesPage() {
  await requirePermission("canManageEstoque");

  const [ingredients, entradas, saidas] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    prisma.stockMovement.findMany({
      where: { type: "ENTRADA" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { ingredient: true, user: true },
    }),
    prisma.stockMovement.findMany({
      where: { type: "SAIDA" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { ingredient: true, user: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Movimentações</h1>
        <p className="text-sm text-neutral-500">Lance entradas e saídas manuais de insumos.</p>
      </div>

      <Tabs defaultValue="entrada">
        <TabsList>
          <TabsTrigger value="entrada">Entrada</TabsTrigger>
          <TabsTrigger value="saida">Saída</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <MovementForm ingredients={ingredients} type="ENTRADA" />
            <MovementsTable movements={entradas} />
          </div>
        </TabsContent>

        <TabsContent value="saida" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <MovementForm ingredients={ingredients} type="SAIDA" />
            <MovementsTable movements={saidas} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
