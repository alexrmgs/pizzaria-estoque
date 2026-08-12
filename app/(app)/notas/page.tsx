import { requirePermission } from "@/lib/dal";
import { NotasEntradaPanel } from "./notas-list";

export default async function NotasPage() {
  await requirePermission("canManageEstoque");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Notas de Entrada</h1>
        <p className="text-sm text-neutral-500">
          Entrada de estoque por nota fiscal (XML, digitada ou recebidas do seu CNPJ).
        </p>
      </div>
      <NotasEntradaPanel />
    </div>
  );
}
