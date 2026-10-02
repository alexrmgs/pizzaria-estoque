import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { todayInBrazil } from "@/lib/payroll";
import {
  buildRelatorioPonto,
  formatDiaBR,
  formatHoras,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type DiaPonto,
} from "@/lib/relatorio-ponto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintButton } from "@/components/print-button";
import { AjustarDiaDialog } from "./ajustar-dia-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SITUACAO_LABEL: Record<DiaPonto["situacao"], string> = {
  TRABALHOU: "",
  EM_ABERTO: "Sem saída",
  FALTA: "FALTA",
  ATESTADO: "Atestado",
  FOLGA: "Folga",
  SEM_REGISTRO: "Sem registro",
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Mês padrão: o anterior (é o que a contabilidade pede no começo do mês). */
function defaultMes() {
  const today = todayInBrazil();
  const prev = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 7);
}

export default async function RelatorioPontoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; funcionario?: string }>;
}) {
  const user = await requirePermission("canManageFuncionarios");
  const params = await searchParams;
  const mes = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : defaultMes();
  const funcionario = params.funcionario || undefined;

  const [relatorio, employees, settings] = await Promise.all([
    buildRelatorioPonto(mes, funcionario),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    getAppSettings(user.companyId),
  ]);
  const empresaLinha = [
    settings.labelCnpj && `CNPJ: ${settings.labelCnpj}`,
    settings.labelEndereco,
    settings.labelCidade,
  ]
    .filter(Boolean)
    .join(" · ");

  const [ano, mesNum] = mes.split("-").map(Number);
  const mesLabel = `${MESES[mesNum - 1]} de ${ano}`;
  const planilhaHref = `/relatorio-ponto/planilha?mes=${mes}${funcionario ? `&funcionario=${funcionario}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        {settings.labelEmpresa && (
          <p className="hidden text-lg font-bold print:block">{settings.labelEmpresa}</p>
        )}
        {empresaLinha && <p className="hidden text-xs text-neutral-500 print:block">{empresaLinha}</p>}
        <h1 className="text-2xl font-semibold uppercase">Relatório de Ponto — {mesLabel}</h1>
        <p className="text-sm text-neutral-500 print:hidden">
          Entrada, saída, horas noturnas (22h às 5h), feriados, faltas e atestados de cada
          funcionário no mês — pra mandar pra contabilidade.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="flex flex-col gap-1 text-xs">
          Mês
          <Input type="month" name="mes" defaultValue={mes} className="h-9 w-44" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Funcionário
          <select
            name="funcionario"
            defaultValue={funcionario ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.active ? "" : " (desligado)"}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="h-9">
          Ver
        </Button>
        <a href={planilhaHref}>
          <Button type="button" className="h-9">
            Baixar Excel (pra enviar por email)
          </Button>
        </a>
        <PrintButton />
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead className="text-right">Dias trab.</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Horas noturnas</TableHead>
              <TableHead>Feriados trabalhados</TableHead>
              <TableHead>Faltas</TableHead>
              <TableHead>Atestados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relatorio.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500">
                  Nenhum funcionário nesse mês.
                </TableCell>
              </TableRow>
            )}
            {relatorio.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="text-right">{f.diasTrabalhados}</TableCell>
                <TableCell className="text-right">{formatHoras(f.totalHoras)}</TableCell>
                <TableCell className="text-right">{formatHoras(f.totalNoturnas)}</TableCell>
                <TableCell>{diasCurtos(f.feriadosTrabalhados)}</TableCell>
                <TableCell className={f.faltas.length ? "font-semibold text-destructive" : ""}>
                  {diasCurtos(f.faltas)}
                </TableCell>
                <TableCell>{diasCurtos(f.atestados)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {relatorio.map((f) => (
        <section key={f.id} className="break-inside-avoid-page rounded-lg border bg-white print:break-before-page">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b p-3">
            <div>
              <p className="font-semibold uppercase">{f.name}</p>
              <p className="text-xs text-neutral-500">
                {[f.role, f.storeName].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              {f.hireDate && `Admissão ${formatDiaBR(f.hireDate)} · `}
              {(f.scheduledStart || f.scheduledEnd) &&
                `Horário ${f.scheduledStart ?? "?"} às ${f.scheduledEnd ?? "?"} · `}
              {f.weeklyDayOff !== null && `Folga: ${WEEKDAY_LONG[f.weeklyDayOff]}`}
            </p>
            <p className="text-sm text-neutral-600">
              {f.diasTrabalhados} dias · {formatHoras(f.totalHoras)} h · noturnas{" "}
              {formatHoras(f.totalNoturnas)} h · {f.faltas.length} falta(s) · {f.atestados.length}{" "}
              atestado(s)
            </p>
          </div>
          {f.semRegistro.length > 0 && (
            <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">
              Dias sem ponto e sem falta/folga lançada: {diasCurtos(f.semRegistro)} — confira em
              Ponto da Equipe antes de mandar.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Diurnas</TableHead>
                <TableHead className="text-right">Noturnas</TableHead>
                <TableHead>Obs.</TableHead>
                <TableHead className="print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.dias.map((d) => (
                <TableRow key={d.date} className={d.situacao === "FOLGA" ? "text-neutral-400" : ""}>
                  <TableCell className="whitespace-nowrap">
                    {formatDiaBR(d.date).slice(0, 5)} {WEEKDAY_SHORT[d.weekday]}
                  </TableCell>
                  <TableCell>{d.batidas.map((b) => b.entrada).join(" / ") || "—"}</TableCell>
                  <TableCell>{d.batidas.map((b) => b.saida ?? "?").join(" / ") || "—"}</TableCell>
                  <TableCell className="text-right">{d.horas ? formatHoras(d.horas) : ""}</TableCell>
                  <TableCell className="text-right">
                    {d.horas ? formatHoras(d.horas - d.horasNoturnas) : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {d.horasNoturnas ? formatHoras(d.horasNoturnas) : ""}
                  </TableCell>
                  <TableCell
                    className={
                      d.situacao === "FALTA"
                        ? "font-semibold text-destructive"
                        : d.situacao === "SEM_REGISTRO" || d.situacao === "EM_ABERTO"
                          ? "text-amber-700"
                          : ""
                    }
                  >
                    {[d.feriado ? `Feriado: ${d.feriado}` : "", SITUACAO_LABEL[d.situacao], d.obs ?? ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </TableCell>
                  <TableCell className="text-right print:hidden">
                    <AjustarDiaDialog
                      employeeId={f.id}
                      employeeName={f.name}
                      date={d.date}
                      dateLabel={`${formatDiaBR(d.date)} (${WEEKDAY_LONG[d.weekday]})`}
                      situacaoAtual={d.situacao}
                      batida={d.batidas[0] ?? null}
                      dayOffReason={d.dayOffReason}
                      temMaisBatidas={d.batidas.length > 1}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="hidden grid-cols-2 gap-12 px-8 pb-4 pt-14 text-center text-xs print:grid">
            <div className="border-t border-black pt-1">{f.name}</div>
            <div className="border-t border-black pt-1">Responsável pela empresa</div>
          </div>
        </section>
      ))}
    </div>
  );
}

function diasCurtos(dates: string[]) {
  return dates.length ? dates.map((d) => formatDiaBR(d).slice(0, 5)).join(", ") : "—";
}
