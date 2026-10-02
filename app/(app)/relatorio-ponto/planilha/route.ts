import { requirePermission } from "@/lib/dal";
import { getAppSettings } from "@/lib/settings";
import { buildRelatorioPonto } from "@/lib/relatorio-ponto";
import { buildPontoWorkbook } from "@/lib/relatorio-ponto-xlsx";

export async function GET(request: Request) {
  const user = await requirePermission("canManageFuncionarios");
  const url = new URL(request.url);
  const mes = url.searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Mês inválido.", { status: 400 });
  const funcionario = url.searchParams.get("funcionario") || undefined;

  const [relatorio, settings] = await Promise.all([
    buildRelatorioPonto(mes, funcionario),
    getAppSettings(user.companyId),
  ]);
  const { buffer, filename } = await buildPontoWorkbook(
    relatorio,
    {
      nome: settings.labelEmpresa ?? "",
      cnpj: settings.labelCnpj ?? "",
      endereco: settings.labelEndereco ?? "",
      cidade: settings.labelCidade ?? "",
    },
    mes,
  );

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ponto.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
