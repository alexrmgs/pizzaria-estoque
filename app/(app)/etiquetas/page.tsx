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
import { FilaPedidos } from "./fila-pedidos";
import { ReimprimirPedidoButton } from "./reimprimir-pedido-button";
import { LimparFilaButton } from "./limpar-fila-button";
import { BluetoothTest } from "./bluetooth-test";

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
    prisma.printJob.findMany({
      where: { tipo: "PEDIDO" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getAppSettings(),
  ]);

  // Fila = próximos 20 números a partir do início, pulando os já impressos.
  const inicio = settings.etiquetaProximoNumero;
  const impressos = new Set((settings.etiquetaImpressos as unknown as number[]) ?? []);
  const fila: number[] = [];
  for (let num = inicio; fila.length < 20 && num < inicio + 500; num++) {
    if (!impressos.has(num)) fila.push(num);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Etiquetas — Pedidos</h1>
        <p className="text-sm text-neutral-500">
          A numeração é automática. Clique no pedido, escolha quantas caixas e imprima — uma
          etiqueta por volume, numeradas (ex: 1/3, 2/3, 3/3).
        </p>
      </div>

      <FilaPedidos
        fila={fila}
        inicio={inicio}
        widthMm={settings.labelWidthMm}
        heightMm={settings.labelHeightMm}
      />

      <div className="max-w-lg rounded-lg border border-dashed bg-white p-3">
        <BluetoothTest />
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-semibold uppercase text-neutral-500">Últimas etiquetas</span>
          <LimparFilaButton />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Volumes</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Nenhuma etiqueta enviada ainda.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.pedido}</TableCell>
                <TableCell className="text-neutral-500">{job.cliente ?? "—"}</TableCell>
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
                  <ReimprimirPedidoButton
                    id={job.id}
                    pedido={job.pedido ?? ""}
                    cliente={job.cliente}
                    volumes={job.volumes ?? 1}
                    volumeUnico={job.volumeUnico}
                    widthMm={job.labelWidthMm}
                    heightMm={job.labelHeightMm}
                  />
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
