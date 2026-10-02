import { requirePermission } from "@/lib/dal";
import { todayInBrazil } from "@/lib/payroll";
import { buildRelatorioCmo } from "@/lib/relatorio-cmo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrintButton } from "@/components/print-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function defaultMes() {
  const today = todayInBrazil();
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 7);
}

export default async function CmoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requirePermission("canManageFuncionarios");
  const params = await searchParams;
  const mes = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : defaultMes();
  const r = await buildRelatorioCmo(mes, user.companyId);
  const [ano, m] = mes.split("-").map(Number);
  const estimados = r.funcionarios.filter((f) => f.status === "ESTIMADA").length;

  const sum = (fn: (f: (typeof r.funcionarios)[number]) => number) =>
    r.funcionarios.reduce((s, f) => s + fn(f), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold uppercase">
          Custo de Mão de Obra — {MESES[m - 1]} de {ano}
        </h1>
        <p className="text-sm text-neutral-500 print:hidden">
          Quanto a empresa gastou com funcionários no mês: salário, adicionais, bônus, madrugada,
          FGTS e rescisões, já descontando faltas e atrasos.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="flex flex-col gap-1 text-xs">
          Mês
          <Input type="month" name="mes" defaultValue={mes} className="h-9 w-44" />
        </label>
        <Button type="submit" variant="outline" className="h-9">
          Ver
        </Button>
        <a href={`/cmo/planilha?mes=${mes}`}>
          <Button type="button" className="h-9">
            Baixar Excel
          </Button>
        </a>
        <PrintButton />
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">CMO total do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{brl(r.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">Faturamento do mês (FB Eusébio)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{brl(r.faturamento)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-neutral-500">CMO / faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {r.percentual !== null ? `${r.percentual.toFixed(1).replace(".", ",")}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {estimados > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {estimados} funcionário(s) ainda sem folha fechada nesse mês — entram com o valor
          previsto (marcado como &quot;Estimada&quot;). Feche a folha em Folha de Pagamento pro
          número ficar exato.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Folha</TableHead>
              <TableHead className="text-right">Salário</TableHead>
              <TableHead className="text-right">Adic. noturno</TableHead>
              <TableHead className="text-right">Horas extras</TableHead>
              <TableHead className="text-right">Feriados</TableHead>
              <TableHead className="text-right">Bônus</TableHead>
              <TableHead className="text-right">Descontos</TableHead>
              <TableHead className="text-right">Madrugada</TableHead>
              <TableHead className="text-right">FGTS (est.)</TableHead>
              <TableHead className="text-right">Rescisão</TableHead>
              <TableHead className="text-right">Custo total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.funcionarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-neutral-500">
                  Nenhum funcionário nesse mês.
                </TableCell>
              </TableRow>
            )}
            {r.funcionarios.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-neutral-500">
                    {[f.role, f.storeName].filter(Boolean).join(" · ")}
                  </p>
                </TableCell>
                <TableCell>
                  {f.status === "FECHADA" ? (
                    <Badge variant="secondary">Fechada</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Estimada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{brl(f.salario)}</TableCell>
                <TableCell className="text-right">{brl(f.adicionalNoturno)}</TableCell>
                <TableCell className="text-right">{brl(f.horasExtras)}</TableCell>
                <TableCell className="text-right">{brl(f.feriados)}</TableCell>
                <TableCell className="text-right">{brl(f.bonus)}</TableCell>
                <TableCell className="text-right text-destructive">
                  {f.descontos ? `−${brl(f.descontos)}` : brl(0)}
                </TableCell>
                <TableCell className="text-right">{brl(f.madrugada)}</TableCell>
                <TableCell className="text-right">{brl(f.fgts)}</TableCell>
                <TableCell className="text-right">{brl(f.rescisao)}</TableCell>
                <TableCell className="text-right font-semibold">{brl(f.total)}</TableCell>
              </TableRow>
            ))}
            {r.funcionarios.length > 1 && (
              <TableRow className="bg-neutral-50 font-semibold">
                <TableCell>TOTAL</TableCell>
                <TableCell />
                <TableCell className="text-right">{brl(sum((f) => f.salario))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.adicionalNoturno))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.horasExtras))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.feriados))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.bonus))}</TableCell>
                <TableCell className="text-right text-destructive">
                  −{brl(sum((f) => f.descontos))}
                </TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.madrugada))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.fgts))}</TableCell>
                <TableCell className="text-right">{brl(sum((f) => f.rescisao))}</TableCell>
                <TableCell className="text-right">{brl(r.total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-neutral-500">
        FGTS estimado em 8% só pra quem tem carteira assinada. Vales e adiantamentos não somam à
        parte — já fazem parte do salário.
      </p>
    </div>
  );
}
