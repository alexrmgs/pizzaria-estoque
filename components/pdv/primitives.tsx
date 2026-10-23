import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Bike, Store, Ticket, UtensilsCrossed, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Componentes base do PDV. Só funcionam dentro de um container .pdv (ver
// app/pdv-theme.css) — usam os tokens pdv-*, nunca hex solto.

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pdvButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pdv-md font-semibold whitespace-nowrap transition-colors duration-100 outline-none select-none focus-visible:ring-3 focus-visible:ring-pdv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pdv-bg active:translate-y-px disabled:pointer-events-none disabled:opacity-40 data-[loading]:cursor-wait [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-pdv-accent text-pdv-on-accent hover:bg-pdv-accent-hover",
        secondary: "border border-pdv-line bg-pdv-raised text-pdv-text hover:border-pdv-line-input",
        ghost: "text-pdv-muted hover:bg-pdv-raised hover:text-pdv-text",
        danger: "bg-pdv-danger text-pdv-on-accent hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3 text-sm [&_svg]:size-4",
        md: "h-12 px-4 text-base [&_svg]:size-5",
        lg: "h-16 px-6 font-pdv-display text-lg font-extrabold tracking-wide uppercase [&_svg]:size-6",
        icon: "size-12 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export function PdvButton({
  className,
  variant,
  size,
  loading,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof pdvButtonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      {...props}
      className={cn(pdvButtonVariants({ variant, size, className }))}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </ButtonPrimitive>
  );
}

export type Modulo = "DELIVERY" | "BALCAO" | "SALAO" | "FICHA";

export const MODULOS: Record<Modulo, { label: string; icon: LucideIcon; text: string; bg: string; border: string }> = {
  DELIVERY: { label: "Delivery", icon: Bike, text: "text-pdv-delivery", bg: "bg-pdv-delivery", border: "border-pdv-delivery" },
  BALCAO: { label: "Balcão", icon: Store, text: "text-pdv-balcao", bg: "bg-pdv-balcao", border: "border-pdv-balcao" },
  SALAO: { label: "Mesa", icon: UtensilsCrossed, text: "text-pdv-mesa", bg: "bg-pdv-mesa", border: "border-pdv-mesa" },
  FICHA: { label: "Ficha", icon: Ticket, text: "text-pdv-ficha", bg: "bg-pdv-ficha", border: "border-pdv-ficha" },
};

/** Etiqueta do tipo de pedido — cor + ícone + texto (nunca só a cor). */
export function ModuloTag({ modulo, solid, className }: { modulo: Modulo; solid?: boolean; className?: string }) {
  const m = MODULOS[modulo];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold tracking-wide uppercase",
        solid ? cn(m.bg, "text-pdv-on-accent") : cn("border", m.border, m.text),
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

/** Campo de texto/número do PDV: 48px de altura, rótulo sempre visível. */
export function PdvField({
  label,
  error,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={fieldId} className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold tracking-wide text-pdv-muted uppercase">{label}</span>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-err` : undefined}
        className="h-12 rounded-pdv-sm border border-pdv-line-input bg-pdv-bg px-3 text-base text-pdv-text placeholder:text-pdv-muted/70 outline-none focus-visible:border-pdv-accent focus-visible:ring-3 focus-visible:ring-pdv-accent/40 disabled:opacity-40 aria-invalid:border-pdv-danger"
        {...props}
      />
      {error ? (
        <span id={`${fieldId}-err`} role="alert" className="text-sm text-pdv-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Minutos desde `desde`, com estado de atraso a partir de `limiteMin`. */
export function Cronometro({ minutos, limiteMin = 30 }: { minutos: number; limiteMin?: number }) {
  const atrasado = minutos >= limiteMin;
  const alerta = !atrasado && minutos >= limiteMin * 0.75;
  return (
    <span
      className={cn(
        "font-mono text-sm font-bold tabular-nums",
        atrasado ? "pdv-late text-pdv-danger" : alerta ? "text-pdv-warning" : "text-pdv-muted"
      )}
      aria-label={`${minutos} minutos${atrasado ? ", atrasado" : ""}`}
    >
      {minutos}min
    </span>
  );
}
