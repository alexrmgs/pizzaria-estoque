import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FixedCostForm } from "./fixed-cost-form";
import { VariableCostForm } from "./variable-cost-form";
import { DeleteFixedCostButton } from "./delete-fixed-cost-button";
import { DeleteVariableCostButton } from "./delete-variable-cost-button";

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function formatMonth(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function PrecificacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("canViewRelatorios");
  const params = await searchParams;

  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });
  const storeIdParam = typeof params.storeId === "string" && params.storeId ? params.storeId : undefined;
  const selectedStoreId = storeIdParam ?? stores[0]?.id ?? "";
  const activeTab = params.tab === "custos-variaveis" ? "custos-variaveis" : "custos-fixos";

  const [fixedCosts, variableCosts] = await Promise.all([
    selectedStoreId
      ? prisma.fixedCost.findMany({
          where: { storeId: selectedStoreId },
          orderBy: [{ referenceMonth: "desc" }, { category: "asc" }],
        })
      : Promise.resolve([]),
    selectedStoreId
      ? prisma.variableCostRate.findMany({
          where: { storeId: selectedStoreId },
          orderBy: { category: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const totalVariablePercent = variableCosts.reduce((sum, c) => sum + Number(c.percentage), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Precificação</h1>
        <p className="text-sm text-neutral-500">
          Cadastre os custos fixos e variáveis de cada loja pra usar na precificação.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <input type="hidden" name="tab" value={activeTab} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="storeId">
            Loja
          </label>
          <select id="storeId" name="storeId" defaultValue={selectedStoreId} className={selectClassName}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Trocar loja
        </Button>
      </form>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="custos-fixos">Custos Fixos</TabsTrigger>
          <TabsTrigger value="custos-variaveis">Custos Variáveis</TabsTrigger>
        </TabsList>

        <TabsContent value="custos-fixos" className="flex flex-col gap-6 pt-4">
          <FixedCostForm storeId={selectedStoreId} />

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedCosts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      Nenhum custo fixo cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {fixedCosts.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium capitalize">{formatMonth(cost.referenceMonth)}</TableCell>
                    <TableCell>{cost.category}</TableCell>
                    <TableCell>{currency(Number(cost.amount))}</TableCell>
                    <TableCell className="text-neutral-500">{cost.note ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <DeleteFixedCostButton id={cost.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="custos-variaveis" className="flex flex-col gap-6 pt-4">
          <VariableCostForm storeId={selectedStoreId} />

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variableCosts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-neutral-500">
                      Nenhum custo variável cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {variableCosts.map((cost) => (
                  <TableRow key={cost.id}>
                    <TableCell className="font-medium">{cost.category}</TableCell>
                    <TableCell>{Number(cost.percentage).toLocaleString("pt-BR")}%</TableCell>
                    <TableCell className="text-right">
                      <DeleteVariableCostButton id={cost.id} />
                    </TableCell>
                  </TableRow>
                ))}
                {variableCosts.length > 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {totalVariablePercent.toLocaleString("pt-BR")}%
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
