import fs from "fs";
import path from "path";

let cached: string | null = null;

/**
 * Logo embutido como data URI (base64) — usado nas páginas de impressão em
 * vez de `<img src="/logo.png">`. Um `src` apontando pro arquivo estático
 * depende de o navegador buscar esse recurso a tempo de entrar no PDF/print;
 * em alguns fluxos de impressão (principalmente Chrome Android) essa busca
 * não conclui a tempo e o logo sai em branco. Com os bytes já embutidos no
 * HTML, não tem requisição nenhuma pra correr contra o tempo.
 */
export function logoDataUri(): string {
  if (cached) return cached;
  const bytes = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
  cached = `data:image/png;base64,${bytes.toString("base64")}`;
  return cached;
}
