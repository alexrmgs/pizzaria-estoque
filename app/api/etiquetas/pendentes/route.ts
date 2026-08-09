import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// O programa do PC da loja chama esse endpoint em loop pra pegar as etiquetas
// que ainda não foram impressas. Protegido por um token secreto.
export async function GET(request: Request) {
  const token = process.env.PRINT_AGENT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Fila de impressão não configurada." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const jobs = await prisma.printJob.findMany({
    where: { status: "PENDENTE" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      tipo: true,
      pedido: true,
      volumes: true,
      produto: true,
      producaoData: true,
      validadeData: true,
      copias: true,
      labelWidthMm: true,
      labelHeightMm: true,
    },
  });

  return NextResponse.json({ jobs });
}
