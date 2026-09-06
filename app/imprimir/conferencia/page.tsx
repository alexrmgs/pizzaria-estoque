import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { todayInBrazil } from "@/lib/payroll";
import { PrintButton } from "@/components/print-button";

const brDate = (iso: string) => iso.split("-").reverse().join("/");

export default async function ImprimirConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("canManageEstoque");
  const params = await searchParams;
  const categoryId = typeof params.categoria === "string" ? params.categoria : undefined;

  const [settings, ingredients] = await Promise.all([
    getAppSettings(user.companyId),
    prisma.ingredient.findMany({
      where: categoryId ? { categoryId, active: true } : { active: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: true },
    }),
  ]);

  const byCategory = new Map<string, typeof ingredients>();
  for (const ingredient of ingredients) {
    const key = ingredient.category?.name ?? "Sem categoria";
    const list = byCategory.get(key) ?? [];
    list.push(ingredient);
    byCategory.set(key, list);
  }

  const hoje = brDate(todayInBrazil().toISOString().slice(0, 10));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-8 print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: A4; margin: 10mm; } }",
        }}
      />
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-500">Guia de conferência de estoque pra impressão</p>
        <PrintButton />
      </div>

      <div className="flex items-center justify-between border-b border-black pb-2">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt={settings.labelEmpresa || "Empresa"} width={48} height={47} />
          <div>
            <p className="text-lg font-bold uppercase">{settings.labelEmpresa || "Empresa"}</p>
            <p className="text-sm text-neutral-600">Guia de Conferência de Estoque</p>
          </div>
        </div>
        <div className="text-right text-sm text-neutral-600">
          <p>Data da contagem: ___/___/____</p>
          <p>Gerado em {hoje}</p>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Preencha a coluna &quot;Contagem física&quot; com o que você contou no estoque. Depois,
        digite os valores no sistema em Conferência de Estoque — só os itens com diferença geram
        ajuste automático.
      </p>

      {[...byCategory.entries()].map(([categoryName, items]) => (
        <table key={categoryName} className="w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-black bg-neutral-100">
              <th
                colSpan={3}
                className="border border-black px-2 py-1 text-left font-semibold uppercase"
              >
                {categoryName}
              </th>
            </tr>
            <tr className="border-b border-black">
              <th className="w-1/2 border border-black px-2 py-1 text-left font-semibold">
                Produto
              </th>
              <th className="w-16 border border-black px-2 py-1 text-left font-semibold">
                Unidade
              </th>
              <th className="border border-black px-2 py-1 text-left font-semibold">
                Contagem física
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((ingredient) => (
              <tr key={ingredient.id} className="border-b border-neutral-300">
                <td className="border border-black px-2 py-2">{ingredient.name}</td>
                <td className="border border-black px-2 py-2">{ingredient.unit}</td>
                <td className="border border-black px-2 py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <div className="mt-4 flex justify-end gap-8 text-center text-[11px]">
        <div className="w-52 border-t border-black pt-1">Conferido por</div>
        <div className="w-32 border-t border-black pt-1">Data ___/___/____</div>
      </div>
    </div>
  );
}
