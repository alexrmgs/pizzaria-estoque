"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { alternarDomingo, gerarRodizio, importarEscalaBase } from "./rodizio-actions";

type Linha = { id: string; name: string; folgas: string[] };

const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function RodizioDomingos({
  domingos,
  linhas,
  todayISO,
  temRodizio,
  ciclo,
}: {
  domingos: string[];
  linhas: Linha[];
  todayISO: string;
  temRodizio: boolean;
  ciclo: number;
}) {
  const [isPending, startTransition] = useTransition();

  function clicar(employeeId: string, date: string) {
    startTransition(async () => {
      const r = await alternarDomingo(employeeId, date);
      if (r.error) toast.error(r.error);
    });
  }

  function gerar() {
    startTransition(async () => {
      const r = await gerarRodizio();
      toast.success(`${r.criados} folga(s) de domingo lançada(s).`);
      if (r.semRodizio.length) {
        toast.warning(`Sem domingo definido (clique num domingo pra começar): ${r.semRodizio.join(", ")}`);
      }
    });
  }

  function importar() {
    if (!confirm("Lançar a escala base (out/nov 2026) e gerar o rodízio dos próximos meses?")) return;
    startTransition(async () => {
      const r = await importarEscalaBase();
      toast.success(`Escala importada. ${r.criados} folga(s) futura(s) gerada(s).`);
      if (r.naoEncontrados.length) {
        toast.warning(`Não achei no cadastro: ${r.naoEncontrados.join(", ")} — lance esses à mão no quadro.`);
      }
      if (r.ambiguos.length) {
        toast.warning(`Mais de um funcionário com o nome: ${r.ambiguos.join(", ")} — lance à mão.`);
      }
    });
  }

  const porDomingo = new Map(domingos.map((d) => [d, linhas.filter((l) => l.folgas.includes(d)).length]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!temRodizio && (
          <Button onClick={importar} disabled={isPending}>
            Importar escala base (out/nov)
          </Button>
        )}
        <Button onClick={gerar} disabled={isPending} variant={temRodizio ? "default" : "outline"}>
          {isPending ? "Salvando..." : "Gerar próximos 6 meses"}
        </Button>
        <p className="text-xs text-neutral-500">
          1 domingo de folga a cada {ciclo} domingos, contando do último domingo de folga de cada
          um. Clique num quadrinho pra ajustar — o rodízio da pessoa segue a partir dali.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left font-medium">
                Funcionário
              </th>
              {domingos.map((d) => (
                <th key={d} className="px-1 py-2 text-center text-xs font-medium">
                  <div>{curto(d)}</div>
                  <div className="font-normal text-neutral-400">{porDomingo.get(d)} folga</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium">
                  {l.name}
                </td>
                {domingos.map((d) => {
                  const folga = l.folgas.includes(d);
                  const passado = d < todayISO;
                  return (
                    <td key={d} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        disabled={passado || isPending}
                        onClick={() => clicar(l.id, d)}
                        title={folga ? "Folga — clique pra tirar" : "Trabalha — clique pra dar folga"}
                        className={cn(
                          "h-7 w-9 rounded text-xs font-semibold transition-colors",
                          folga
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-neutral-100 text-neutral-400 hover:bg-blue-100",
                          passado && "cursor-default opacity-50 hover:bg-inherit",
                        )}
                      >
                        {folga ? "F" : "T"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
