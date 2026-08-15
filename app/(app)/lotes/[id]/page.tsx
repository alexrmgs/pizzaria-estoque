import { notFound } from "next/navigation";
import { buscarLote } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmarBaixaButton } from "./confirmar-baixa-button";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lote = await buscarLote(id);
  if (!lote) notFound();

  const vencido = lote.expiresAt ? lote.expiresAt.getTime() < new Date().getTime() : false;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{lote.ingredientName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Peso/quantidade</span>
            <span className="text-lg font-semibold">
              {lote.quantity} {lote.unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Fabricação</span>
            <span>{formatDate(lote.producedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Validade</span>
            <span className={vencido ? "font-semibold text-destructive" : ""}>
              {formatDate(lote.expiresAt)}
              {vencido && " (vencido)"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Situação</span>
            {lote.status === "BAIXADO" ? (
              <Badge variant="secondary">Baixado</Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800">Em estoque</Badge>
            )}
          </div>

          {lote.status === "BAIXADO" ? (
            <p className="mt-2 rounded-md bg-neutral-100 p-3 text-center text-sm text-neutral-600">
              Esse lote já foi baixado{lote.consumedByName ? ` por ${lote.consumedByName}` : ""}
              {lote.consumedAt ? ` em ${formatDate(lote.consumedAt)}` : ""}.
            </p>
          ) : (
            <ConfirmarBaixaButton id={lote.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
