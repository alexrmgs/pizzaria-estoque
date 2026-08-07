import { requirePermission } from "@/lib/dal";

export default async function PrecificacaoPage() {
  await requirePermission("canViewRelatorios");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Precificação</h1>
        <p className="text-sm text-neutral-500">Em breve.</p>
      </div>
    </div>
  );
}
