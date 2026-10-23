import { requirePdv } from "@/lib/pdv";
import { GestaoMenu } from "./menu";

export default async function GestaoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requirePdv(storeId, "gerenciar");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-3 md:flex-row md:gap-6 md:p-6">
      <GestaoMenu storeId={store!.id} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
