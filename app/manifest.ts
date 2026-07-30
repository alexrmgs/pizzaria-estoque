import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FB Pizzaria & Esfiharia — Gestão",
    short_name: "FB Gestão",
    description: "Estoque, produção, ponto e gestão de equipe da FB Pizzaria & Esfiharia",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fe9400",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
