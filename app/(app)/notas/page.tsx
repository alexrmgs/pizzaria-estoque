import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewNota } from "./new-nota";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—";

export default async function NotasPage() {
  await requirePermission("canManageEstoque");

  const notas = await prisma.notaFiscal.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Notas de Entrada</h1>
          <p className="text-sm text-neutral-500">
            Suba o XML da nota do fornecedor (ou digite), confira os itens e lance a entrada no
            estoque. Se for boleto, já cria a conta a pagar.
          </p>
        </div>
        <NewNota />
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emissão</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500">
                  Nenhuma nota ainda. Clique em <b>Subir XML</b> ou <b>Digitar</b>.
                </TableCell>
              </TableRow>
            )}
            {notas.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-neutral-500">{brDate(n.emissao)}</TableCell>
                <TableCell className="font-medium">{n.fornecedor ?? "—"}</TableCell>
                <TableCell className="text-neutral-500">{n.numero ?? "—"}</TableCell>
                <TableCell className="text-neutral-500">{n._count.items}</TableCell>
                <TableCell className="text-right">{currency(Number(n.total))}</TableCell>
                <TableCell>
                  {n.status === "LANCADA" ? (
                    <Badge variant="secondary">Lançada</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Conferindo</Badge>
                  )}
                  {n.boleto && <Badge className="ml-1 bg-blue-100 text-blue-800">Boleto</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/notas/${n.id}`} className="text-sm font-medium text-primary hover:underline">
                    {n.status === "LANCADA" ? "Ver" : "Conferir"}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
