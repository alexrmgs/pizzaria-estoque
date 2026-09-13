// Bitmap monocromático (1bpp) do logo, pra desenhar via comando TSPL BITMAP
// na etiqueta de produção — impressora térmica só imprime texto/QR/bitmap,
// não HTML/imagem comum. Gerado offline a partir de public/logo.png (ver
// scripts/gen-logo-bitmap.mjs); os bytes já vêm prontos, sem processar
// imagem em tempo de execução.

export const LOGO_BITMAP_WIDTH = 32; // dots (4mm a 8 dots/mm)
export const LOGO_BITMAP_HEIGHT = 32;
export const LOGO_BITMAP_BYTES_PER_ROW = LOGO_BITMAP_WIDTH / 8;

const LOGO_BITMAP_BASE64 =
  "AD/8AAD//wAD///AB///4A////Af///4Hg4B+DwOAHw8DgA+fD4+Pnw+Pj58Pjw//D44f/weMH/8BgA//AYAH/w+AB/8P///fD///3w///58P//+fD///jw///wfv//8H///+A////AH///gA///wAD//4AAf/4AAA/wAAAAAAA=";

/** Decodifica o base64 embutido pros bytes crus do bitmap (browser: atob). */
export function logoBitmapBytes(): Uint8Array {
  const binary = atob(LOGO_BITMAP_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
