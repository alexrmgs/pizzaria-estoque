import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { buildRelatorioCmo } from "@/lib/relatorio-cmo";
import { buildCmoWorkbook } from "@/lib/relatorio-cmo-xlsx";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export async function GET(request: Request) {
  const user = await requirePermission("canManageFuncionarios");
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Mês inválido.", { status: 400 });

  const [relatorio, settings] = await Promise.all([
    buildRelatorioCmo(mes, user.companyId),
    getAppSettings(user.companyId),
  ]);
  const [ano, m] = mes.split("-").map(Number);
  const buffer = await buildCmoWorkbook(relatorio, settings.labelEmpresa ?? "", `Competência: ${MESES[m - 1]} de ${ano}`);

  const filename = `CMO ${MESES[m - 1]} ${ano}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cmo.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
