import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { CorrectionFactorCalculator } from "./calculator";

export default async function FatorCorrecaoPage() {
  await requirePermission("canManageEstoque");

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fator de Correção</h1>
        <p className="text-sm text-neutral-500">
          Calcule quanto perde na limpeza/preparo de um ingrediente — informe o peso bruto (como
          comprado) e o peso líquido (depois de limpo/preparado) e veja o fator multiplicador.
        </p>
      </div>

      <CorrectionFactorCalculator ingredients={ingredients} />
    </div>
  );
}
