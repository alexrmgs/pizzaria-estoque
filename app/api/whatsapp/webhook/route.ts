import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsappMessage, parseWhatsappWebhookPayload } from "@/lib/whatsapp";
import { interpretStockMessage } from "@/lib/whatsapp-ai";

/** Meta chama esse endpoint uma vez, na hora de configurar o webhook, pra
 * confirmar que o dono do domínio é quem está registrando ele. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

const CONFIRM_WORDS = ["sim", "confirma", "confirmar", "ok"];
const CANCEL_WORDS = ["nao", "não", "cancela", "cancelar"];

/** Recebe mensagens de WhatsApp e registra movimentações de estoque a
 * partir delas. Sempre responde 200 pra Meta não ficar reentregando o
 * evento, mesmo quando a mensagem não pôde ser processada — os erros de
 * negócio (número não cadastrado, sem permissão, etc.) viram uma resposta
 * pro próprio funcionário no WhatsApp, não um erro HTTP. */
export async function POST(req: NextRequest) {
  const payload = await req.json();
  const incoming = parseWhatsappWebhookPayload(payload);
  if (!incoming) return NextResponse.json({ ok: true });

  const { from, text } = incoming;

  try {
    const user = await prisma.user.findUnique({
      where: { whatsappPhone: from },
      include: { role: true },
    });

    if (!user) {
      await sendWhatsappMessage(
        from,
        "Esse número não está cadastrado no sistema. Peça pra um administrador vincular seu WhatsApp ao seu usuário.",
      );
      return NextResponse.json({ ok: true });
    }

    if (!user.role.canManageEstoque) {
      await sendWhatsappMessage(from, "Seu usuário não tem permissão pra mexer no estoque.");
      return NextResponse.json({ ok: true });
    }

    const normalized = text.trim().toLowerCase();

    if (CANCEL_WORDS.includes(normalized)) {
      await prisma.whatsappPendingMovement.deleteMany({ where: { phone: from } });
      await sendWhatsappMessage(from, "Cancelado.");
      return NextResponse.json({ ok: true });
    }

    if (CONFIRM_WORDS.includes(normalized)) {
      const pending = await prisma.whatsappPendingMovement.findFirst({
        where: { phone: from },
        orderBy: { createdAt: "desc" },
        include: { ingredient: true },
      });
      if (!pending) {
        await sendWhatsappMessage(from, "Não tem nenhuma movimentação pendente pra confirmar.");
        return NextResponse.json({ ok: true });
      }

      try {
        const updated = await prisma.$transaction(async (tx) => {
          const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: pending.ingredientId } });
          const current = Number(ingredient.currentStock);
          const quantity = Number(pending.quantity);
          if (pending.type === "SAIDA" && quantity > current) {
            throw new Error(
              `Estoque insuficiente: há apenas ${current} ${ingredient.unit} de ${ingredient.name}.`,
            );
          }
          await tx.stockMovement.create({
            data: {
              ingredientId: pending.ingredientId,
              type: pending.type,
              quantity: pending.quantity,
              reason: `WhatsApp: "${pending.rawMessage}"`,
              userId: pending.userId,
            },
          });
          return tx.ingredient.update({
            where: { id: pending.ingredientId },
            data: {
              currentStock: pending.type === "ENTRADA" ? { increment: quantity } : { decrement: quantity },
            },
          });
        });

        await prisma.whatsappPendingMovement.deleteMany({ where: { phone: from } });
        await sendWhatsappMessage(
          from,
          `✅ Registrado! Estoque atual de ${pending.ingredient.name}: ${Number(updated.currentStock)} ${pending.ingredient.unit}.`,
        );
      } catch (error) {
        await prisma.whatsappPendingMovement.deleteMany({ where: { phone: from } });
        const message = error instanceof Error ? error.message : "Não foi possível registrar a movimentação.";
        await sendWhatsappMessage(from, `❌ ${message} Manda a mensagem de novo se quiser tentar outra quantidade.`);
      }
      return NextResponse.json({ ok: true });
    }

    const ingredients = await prisma.ingredient.findMany({
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    });
    const result = await interpretStockMessage(text, ingredients);

    if (result.status === "clarify") {
      await sendWhatsappMessage(from, result.question);
      return NextResponse.json({ ok: true });
    }

    await prisma.whatsappPendingMovement.deleteMany({ where: { phone: from } });
    await prisma.whatsappPendingMovement.create({
      data: {
        phone: from,
        ingredientId: result.ingredientId,
        quantity: result.quantity,
        type: result.type,
        rawMessage: text,
        userId: user.id,
      },
    });

    const acao = result.type === "ENTRADA" ? "Entrada" : "Saída";
    await sendWhatsappMessage(
      from,
      `${acao} de ${result.quantity} de ${result.ingredientName}. Confirma? Responda SIM ou NÃO.`,
    );
  } catch (error) {
    console.error("[whatsapp/webhook] erro ao processar mensagem", error);
    await sendWhatsappMessage(from, "Deu um erro aqui pra processar sua mensagem. Tenta de novo em instantes.").catch(
      () => {},
    );
  }

  return NextResponse.json({ ok: true });
}
