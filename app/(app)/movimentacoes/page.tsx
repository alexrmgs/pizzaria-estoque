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
import { EditMovementDialog } from "./edit-movement-dialog";
import { DeleteMovementButton } from "./delete-movement-button";
import { NotasEntradaPanel } from "../notas/notas-list";

export const maxDuration = 60;

type Movement = {
  id: string;
  type: "ENTRADA" | "SAIDA";
  createdAt: Date;
  quantity: unknown;
  reason: string | null;
  ingredientId: string;
  ingredient: { name: string; unit: string };
  user: { name: string };
};

type IngredientOption = { id: string; name: string; unit: string; currentStock: number };

function MovementsTable({
  movements,
  ingredients,
}: {
  movements: Movement[];
  ingredients: IngredientOption[];
}) {
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
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-neutral-500">
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
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <EditMovementDialog
                    ingredients={ingredients}
                    movement={{
                      id: movement.id,
                      ingredientId: movement.ingredientId,
                      type: movement.type,
                      quantity: String(movement.quantity),
                      reason: movement.reason,
                    }}
                  />
                  <DeleteMovementButton id={movement.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function MovimentacoesPage() {
  await requirePermission("canManageEstoque");

  const [ingredientRows, entradas, saidas] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, currentStock: true },
    }),
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

  const ingredients: IngredientOption[] = ingredientRows.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    currentStock: Number(i.currentStock),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Movimentações</h1>
        <p className="text-sm text-neutral-500">Lance entradas e saídas manuais de insumos.</p>
      </div>

      <Tabs defaultValue="entrada">
        <TabsList>
          <TabsTrigger value="entrada">Entrada</TabsTrigger>
          <TabsTrigger value="saida">Saída</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="pt-4">
          <Tabs defaultValue="manual">
            <TabsList>
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="nota">Com nota</TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-4">
              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <MovementForm ingredients={ingredients} type="ENTRADA" />
                <MovementsTable movements={entradas} ingredients={ingredients} />
              </div>
            </TabsContent>
            <TabsContent value="nota" className="pt-4">
              <NotasEntradaPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="saida" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <MovementForm ingredients={ingredients} type="SAIDA" />
            <MovementsTable movements={saidas} ingredients={ingredients} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
