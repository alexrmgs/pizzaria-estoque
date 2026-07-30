import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FB Pizzaria & Esfiharia — Estoque",
  description: "Controle de estoque e fichas técnicas da FB Pizzaria & Esfiharia",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FB Gestão",
  },
  other: {
    // iOS ainda depende dessa tag legada (com prefixo apple-) pro modo
    // standalone em versões mais antigas do Safari — o Next nessa versão só
    // gera a tag padrão sem prefixo (mobile-web-app-capable).
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fe9400",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
