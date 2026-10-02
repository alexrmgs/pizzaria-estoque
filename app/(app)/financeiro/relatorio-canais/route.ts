import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/dal";
import { buildRelatorioCanais } from "@/lib/relatorio-canais-xlsx";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const br = (iso: string) => iso.split("-").reverse().join("/");

export async function GET(request: Request) {
  const user = await requirePermission("canViewRelatorios");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) {
    return new Response("Período inválido.", { status: 400 });
  }

  const revenues = await prisma.revenue.findMany({
    where: {
      date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      store: { companyId: user.companyId },
    },
    select: { channel: true, amount: true, orderCount: true, store: { select: { name: true } } },
  });

  const buffer = await buildRelatorioCanais(
    revenues.map((r) => ({
      storeName: r.store.name,
      channel: r.channel,
      amount: Number(r.amount),
      orderCount: r.orderCount,
    })),
    `${br(from)} a ${br(to)}`,
  );

  const filename = `Relatório canais de venda ${br(from).replace(/\//g, "-")} a ${br(to).replace(/\//g, "-")}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-canais.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
