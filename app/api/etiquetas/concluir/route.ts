import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// O programa do PC chama aqui depois de imprimir, pra marcar a etiqueta como
// já impressa e ela sair da fila.
export async function POST(request: Request) {
  const token = process.env.PRINT_AGENT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Fila de impressão não configurada." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let id: unknown;
  try {
    const body = await request.json();
    id = body?.id;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  }

  await prisma.printJob.updateMany({
    where: { id, status: "PENDENTE" },
    data: { status: "IMPRESSO", printedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
