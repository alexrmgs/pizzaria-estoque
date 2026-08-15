import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProducaoAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoteForm } from "./lote-form";
import { LoteRowActions } from "./lote-row-actions";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusValidade(expiresAt: Date | null): "vencido" | "perto" | "ok" | null {
  if (!expiresAt) return null;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const dias = Math.round((expiresAt.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return "vencido";
  if (dias <= 1) return "perto";
  return "ok";
}

export default async function LotesPage() {
  const user = await requireProducaoAccess();

  const [ingredientsRaw, funcionarios, settings, labelsRaw] = await Promise.all([
    prisma.ingredient.findMany({
      where: { isProduced: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getAppSettings(user.companyId),
    prisma.stockLabel.findMany({
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      take: 50,
      include: { ingredient: { select: { name: true, unit: true } } },
    }),
  ]);

  const labels = labelsRaw.map((l) => ({
    id: l.id,
    ingredientName: l.ingredient.name,
    unit: l.ingredient.unit,
    quantity: Number(l.quantity),
    producedAt: l.producedAt,
    expiresAt: l.expiresAt,
    status: l.status,
  }));

  const empresa = {
    nome: settings.labelEmpresa ?? "",
    cnpj: settings.labelCnpj ?? "",
    endereco: settings.labelEndereco ?? "",
    cep: settings.labelCep ?? "",
    cidade: settings.labelCidade ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Lotes — Validade e QR</h1>
          <p className="text-sm text-neutral-500">
            Cada etiqueta impressa aqui vira entrada no estoque. Escaneie o QR na saída pra dar
            baixa automaticamente.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/lotes/scan" />}>
          Escanear QR (dar baixa)
        </Button>
      </div>

      <LoteForm
        ingredients={ingredientsRaw}
        responsaveis={funcionarios.map((f) => f.name)}
        empresa={empresa}
        widthMm={settings.labelProducaoWidthMm}
        heightMm={settings.labelProducaoHeightMm}
      />

      <div className="rounded-lg border bg-white">
        <div className="border-b p-3 text-sm font-semibold uppercase text-neutral-500">
          Últimos lotes
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead>Fabricação</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500">
                  Nenhum lote registrado ainda.
                </TableCell>
              </TableRow>
            )}
            {labels.map((l) => {
              const validade = statusValidade(l.expiresAt);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.ingredientName}</TableCell>
                  <TableCell className="text-neutral-500">
                    {l.quantity} {l.unit}
                  </TableCell>
                  <TableCell className="text-neutral-500">{formatDate(l.producedAt)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        validade === "vencido"
                          ? "font-semibold text-destructive"
                          : validade === "perto"
                            ? "font-semibold text-amber-600"
                            : ""
                      }
                    >
                      {formatDate(l.expiresAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {l.status === "BAIXADO" ? (
                      <Badge variant="secondary">Baixado</Badge>
                    ) : validade === "vencido" ? (
                      <Badge variant="destructive">Vencido</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800">Em estoque</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <LoteRowActions
                      lote={l}
                      empresa={empresa}
                      widthMm={settings.labelProducaoWidthMm}
                      heightMm={settings.labelProducaoHeightMm}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
