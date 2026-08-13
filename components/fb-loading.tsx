import Image from "next/image";

// Animação de carregamento com a logo da FB (pulsando).
export function FbLoading({
  label = "Carregando…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <Image
          src="/logo.png"
          alt="FB"
          width={48}
          height={47}
          priority
          className="relative animate-pulse"
        />
      </div>
      <span className="text-sm text-neutral-500">{label}</span>
    </div>
  );
}
