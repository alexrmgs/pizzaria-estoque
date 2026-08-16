import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Conferencia } from "./conferencia";

export default async function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("canManageEstoque");
  const { id } = await params;

  const [nota, ingredients] = await Promise.all([
    prisma.notaFiscal.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);

  if (!nota) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/notas" className="text-sm text-neutral-500 hover:underline">
          ← Notas de Entrada
        </Link>
        <h1 className="mt-1 text-2xl font-semibold uppercase">
          {nota.status === "LANCADA" ? "Nota lançada" : "Conferir nota"}
        </h1>
      </div>

      <Conferencia
        notaId={nota.id}
        lancada={nota.status === "LANCADA"}
        ingredients={ingredients}
        header={{
          numero: nota.numero ?? "",
          fornecedor: nota.fornecedor ?? "",
          emissao: nota.emissao ? nota.emissao.toISOString().slice(0, 10) : "",
          boleto: nota.boleto,
          vencimento: nota.vencimento ? nota.vencimento.toISOString().slice(0, 10) : "",
          jaPago: nota.jaPago,
          formaPagamento: (nota.formaPagamento as "DINHEIRO" | "PIX" | null) ?? null,
          total: nota.total.toString(),
        }}
        itens={nota.items.map((it) => ({
          description: it.description,
          unit: it.unit,
          quantity: it.quantity.toString(),
          unitValue: it.unitValue.toString(),
          ingredientId: it.ingredientId ?? "",
          qtdEstoque: it.fator ? it.fator.toString() : it.quantity.toString(),
        }))}
      />
    </div>
  );
}
