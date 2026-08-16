import { cn } from "@/lib/utils";
import { REVENUE_CHANNEL_LABELS } from "@/lib/financeiro";

/** Cor de referência de cada canal — usada no selo e reaproveitada nos
 * gráficos (pizza/linha) do financeiro pra manter a mesma identidade visual.
 * iFood/99Food usam a cor real da marca; os demais vêm da paleta categórica
 * validada (contraste + separação pra daltonismo já conferidos). */
export const CHANNEL_COLORS: Record<string, string> = {
  IFOOD: "#EA1D2C",
  NOVENTA_NOVE: "#FFCC00",
  LOJA_PROPRIA: "#9CA3AF",
  CARDAPIO_WEB: "#4a3aa7",
  VOCE_PEDE: "#2a78d6",
  MULTIPEDIDOS: "#eb6834",
};

const CHANNEL_STYLE: Record<string, { bg: string; fg: string }> = {
  IFOOD: { bg: CHANNEL_COLORS.IFOOD, fg: "#FFFFFF" },
  NOVENTA_NOVE: { bg: CHANNEL_COLORS.NOVENTA_NOVE, fg: "#1A1A1A" },
  LOJA_PROPRIA: { bg: "#E5E5E5", fg: "#1A1A1A" },
  CARDAPIO_WEB: { bg: CHANNEL_COLORS.CARDAPIO_WEB, fg: "#FFFFFF" },
  VOCE_PEDE: { bg: CHANNEL_COLORS.VOCE_PEDE, fg: "#FFFFFF" },
  MULTIPEDIDOS: { bg: CHANNEL_COLORS.MULTIPEDIDOS, fg: "#FFFFFF" },
};

function DeliveryBagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Selo colorido do canal de venda (iFood/99Food/loja própria), pra
 * identificar visualmente o canal sem depender só do texto. */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  const style = CHANNEL_STYLE[channel] ?? { bg: "#E5E5E5", fg: "#1A1A1A" };
  const label = REVENUE_CHANNEL_LABELS[channel] ?? channel;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <DeliveryBagIcon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
