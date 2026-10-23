import Image from "next/image";
import Link from "next/link";
import { caixaAberto, garantirSetupPdv, requirePdv } from "@/lib/pdv";
import { PdvNav } from "./pdv-nav";

export default async function PdvLojaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { user, store } = await requirePdv(storeId);
  await garantirSetupPdv(store!.companyId, store!.id);
  const caixa = await caixaAberto(store!.id, user.id);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-pdv-line bg-pdv-bg/95 px-3 backdrop-blur print:hidden md:px-4">
        <Link href="/pdv" className="flex shrink-0 items-center gap-2 rounded-pdv-sm outline-none focus-visible:ring-3 focus-visible:ring-pdv-accent">
          <Image src="/logo.png" alt="Trocar de loja" width={40} height={39} priority />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-pdv-display text-sm font-extrabold">PDV FB</span>
            <span className="max-w-40 truncate text-xs text-pdv-muted">{store!.name}</span>
          </span>
        </Link>
        <PdvNav storeId={store!.id} />
        <Link
          href={`/pdv/${store!.id}/caixa`}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-pdv-sm px-2 py-1 text-sm text-pdv-muted outline-none hover:text-pdv-text focus-visible:ring-3 focus-visible:ring-pdv-accent"
        >
          <span className={`size-2 rounded-full ${caixa ? "bg-pdv-success" : "bg-pdv-danger"}`} aria-hidden />
          <span className="hidden sm:inline">{caixa ? "Caixa aberto" : "Caixa fechado"}</span>
          <span className="sr-only sm:hidden">{caixa ? "Caixa aberto" : "Caixa fechado"}</span>
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
