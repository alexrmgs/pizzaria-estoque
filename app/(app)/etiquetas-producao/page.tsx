import { prisma } from "@/lib/prisma";
import { requireProducaoAccess } from "@/lib/dal";
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
import { ProducaoForm } from "../etiquetas/producao-form";
import { ReimprimirButton } from "../etiquetas/reimprimir-button";

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function EtiquetasProducaoPage() {
  await requireProducaoAccess();

  const [jobs, produtos, funcionarios, settings] = await Promise.all([
    prisma.printJob.findMany({
      where: { tipo: "PRODUCAO" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.ingredient.findMany({
      where: { isProduced: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getAppSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">Etiquetas — Produção</h1>
        <p className="text-sm text-neutral-500">
          Etiqueta pra identificar produções da cozinha (massa, molho, recheio…) com produto, data de
          produção e validade.
        </p>
      </div>

      <ProducaoForm
        produtos={produtos.map((p) => p.name)}
        responsaveis={funcionarios.map((f) => f.name)}
        empresa={{
          nome: settings.labelEmpresa ?? "",
          cnpj: settings.labelCnpj ?? "",
          endereco: settings.labelEndereco ?? "",
          cep: settings.labelCep ?? "",
          cidade: settings.labelCidade ?? "",
        }}
        widthMm={settings.labelProducaoWidthMm}
        heightMm={settings.labelProducaoHeightMm}
      />

      <div className="rounded-lg border bg-white">
        <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
          Últimas etiquetas
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Produção</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Cópias</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500">
                  Nenhuma etiqueta enviada ainda.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.produto}</TableCell>
                <TableCell className="text-neutral-500">{formatDate(job.producaoData)}</TableCell>
                <TableCell>{formatDate(job.validadeData)}</TableCell>
                <TableCell className="text-neutral-500">{job.copias}</TableCell>
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
