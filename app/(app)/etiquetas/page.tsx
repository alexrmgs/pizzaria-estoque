import { prisma } from "@/lib/prisma";
import { requireEtiquetasAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EtiquetaForm } from "./etiqueta-form";
import { ReimprimirButton } from "./reimprimir-button";

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EtiquetasPage() {
  await requireEtiquetasAccess();

  const [jobs, settings] = await Promise.all([
    prisma.printJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getAppSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Etiquetas</h1>
        <p className="text-sm text-neutral-500">
          Digite o pedido e quantos volumes ele tem. O sistema manda pra impressora da loja e imprime
          uma etiqueta por volume, numeradas (ex: 1/3, 2/3, 3/3).
        </p>
      </div>

      <EtiquetaForm widthMm={settings.labelWidthMm} heightMm={settings.labelHeightMm} />

      <div className="rounded-lg border bg-white">
        <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
          Últimas etiquetas
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Volumes</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-500">
                  Nenhuma etiqueta enviada ainda.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.pedido}</TableCell>
                <TableCell>{job.volumes}</TableCell>
                <TableCell className="text-neutral-500">{formatDateTime(job.createdAt)}</TableCell>
                <TableCell>
                  {job.status === "IMPRESSO" ? (
                    <Badge variant="secondary">Impresso</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Na fila</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ReimprimirButton id={job.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="max-w-lg text-xs text-neutral-400">
        As etiquetas saem sozinhas na impressora quando o computador da loja estiver configurado. O
        tamanho é definido em Configurações → Estoque.
      </p>
    </div>
  );
}
