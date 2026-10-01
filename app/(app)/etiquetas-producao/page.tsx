import { prisma } from "@/lib/prisma";
import { requireProducaoAccess } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLote } from "@/lib/lote";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoteForm } from "../lotes/lote-form";
import { LoteRowActions } from "../lotes/lote-row-actions";
import { LimparFilaProducaoButton } from "./limpar-fila-producao-button";

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

export default async function EtiquetasProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ lote?: string; situacao?: string }>;
}) {
  const user = await requireProducaoAccess();
  const { lote, situacao } = await searchParams;
  // Aceita "42", "0042" ou "LOTE 0042".
  const loteNumero = lote ? Number(lote.replace(/\D/g, "")) || undefined : undefined;
  const statusFiltro =
    situacao === "ATIVO" || situacao === "BAIXADO" ? (situacao as "ATIVO" | "BAIXADO") : undefined;
  const filtrando = loteNumero !== undefined || statusFiltro !== undefined;

  const [ingredientsRaw, funcionarios, settings, labelsRaw] = await Promise.all([
    prisma.ingredient.findMany({
      where: { isProduced: true, active: true },
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
      where: {
        ...(loteNumero !== undefined && { numero: loteNumero }),
        ...(statusFiltro && { status: statusFiltro }),
      },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      take: filtrando ? 500 : 50,
      include: { ingredient: { select: { name: true, unit: true } } },
    }),
  ]);

  const labels = labelsRaw.map((l) => ({
    id: l.id,
    numero: l.numero,
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase">Etiquetas / Lotes (Validade)</h1>
          <p className="text-sm text-neutral-500">
            Cada etiqueta impressa aqui vira entrada no estoque (produto, peso, validade) e leva um
            QR code. Pra dar baixa depois, escaneie em Movimentações → Saída.
          </p>
        </div>
        <LimparFilaProducaoButton />
      </div>

      <LoteForm
        ingredients={ingredientsRaw}
        responsaveis={funcionarios.map((f) => f.name)}
        empresa={empresa}
        widthMm={settings.labelProducaoWidthMm}
        heightMm={settings.labelProducaoHeightMm}
      />

      <div className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <span className="text-sm font-semibold uppercase text-neutral-500">
            {filtrando ? "Etiquetas encontradas" : "Últimas etiquetas"}
          </span>
          <form className="flex flex-wrap items-center gap-2">
            <Input
              name="lote"
              defaultValue={lote ?? ""}
              placeholder="Nº do lote"
              inputMode="numeric"
              className="h-9 w-32"
            />
            <select
              name="situacao"
              defaultValue={statusFiltro ?? ""}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="ATIVO">Sem baixa (em estoque)</option>
              <option value="BAIXADO">Baixadas</option>
            </select>
            <Button type="submit" size="sm" className="h-9">
              Buscar
            </Button>
            {filtrando && (
              <a href="/etiquetas-producao" className="text-sm text-neutral-500 underline">
                Limpar
              </a>
            )}
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
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
                <TableCell colSpan={7} className="text-center text-neutral-500">
                  {filtrando ? "Nenhuma etiqueta encontrada." : "Nenhuma etiqueta registrada ainda."}
                </TableCell>
              </TableRow>
            )}
            {labels.map((l) => {
              const validade = statusValidade(l.expiresAt);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-mono font-semibold">{formatLote(l.numero)}</TableCell>
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
                      podeExcluir={user.role.canManageEstoque}
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
