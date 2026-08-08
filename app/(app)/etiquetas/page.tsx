import { requirePermission } from "@/lib/dal";
import { Button } from "@/components/ui/button";

const inputClassName =
  "h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function EtiquetasPage() {
  await requirePermission("canManageEstoque");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Etiquetas</h1>
        <p className="text-sm text-neutral-500">
          Digite o número do pedido e quantos volumes ele tem. O sistema imprime uma etiqueta pra
          cada volume, numeradas (ex: 1/3, 2/3, 3/3).
        </p>
      </div>

      <form
        action="/imprimir/etiquetas"
        method="get"
        target="_blank"
        className="flex max-w-lg flex-wrap items-end gap-3 rounded-lg border bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="pedido">
            Número do pedido
          </label>
          <input
            id="pedido"
            name="pedido"
            inputMode="numeric"
            required
            placeholder="Ex: 1"
            className={`${inputClassName} w-32`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="volumes">
            Volumes
          </label>
          <input
            id="volumes"
            name="volumes"
            type="number"
            min="1"
            max="50"
            defaultValue="1"
            required
            className={`${inputClassName} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="largura">
            Largura (mm)
          </label>
          <input
            id="largura"
            name="largura"
            type="number"
            min="20"
            max="200"
            defaultValue="100"
            required
            className={`${inputClassName} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500" htmlFor="altura">
            Altura (mm)
          </label>
          <input
            id="altura"
            name="altura"
            type="number"
            min="20"
            max="200"
            defaultValue="70"
            required
            className={`${inputClassName} w-24`}
          />
        </div>
        <Button type="submit">Imprimir etiquetas</Button>
      </form>

      <p className="max-w-lg text-xs text-neutral-400">
        A largura e a altura devem ser as mesmas do rolo de etiqueta que você usa na impressora.
        Ajuste uma vez e deixe fixo.
      </p>
    </div>
  );
}
