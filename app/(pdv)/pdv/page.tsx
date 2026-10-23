import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { listarLojasPdv, requirePdv } from "@/lib/pdv";

export default async function PdvInicioPage() {
  const { user } = await requirePdv();
  const lojas = await listarLojasPdv(user.companyId);
  if (lojas.length === 1) redirect(`/pdv/${lojas[0].id}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="FB Pizzaria & Esfiharia" width={56} height={55} priority />
        <h1 className="font-pdv-display text-2xl font-extrabold">Em qual loja?</h1>
      </div>
      {lojas.length === 0 ? (
        <p className="text-pdv-muted">Nenhuma loja cadastrada. Cadastre em Configurações → Lojas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lojas.map((l) => (
            <li key={l.id}>
              <Link
                href={`/pdv/${l.id}`}
                className="flex h-16 items-center rounded-pdv-md border border-pdv-line bg-pdv-surface px-4 text-lg font-semibold outline-none hover:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent"
              >
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard" className="text-sm text-pdv-muted underline-offset-4 hover:underline">
        ← Voltar pro sistema
      </Link>
    </main>
  );
}
