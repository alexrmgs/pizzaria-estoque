import { Montserrat } from "next/font/google";
import { requireUser } from "@/lib/dal";

// O PDV roda em tela cheia, sem a barra lateral do app, no tema escuro da
// marca (app/pdv-theme.css). Montserrat é a fonte de título — a mesma
// família geométrica do letreiro da logo.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export default async function PdvLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className={`pdv ${montserrat.variable} flex min-h-dvh flex-1 flex-col`}>{children}</div>;
}
