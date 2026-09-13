import sharp from "sharp";
import { writeFileSync } from "fs";

// Gera o bitmap monocromático (1bpp) do logo pro comando TSPL BITMAP das
// etiquetas térmicas. Roda uma vez offline — o resultado (bytes já
// empacotados) é embutido como base64 no código, o app nunca precisa
// processar imagem em tempo de execução.

const WIDTH = 32; // múltiplo de 8 -> sem padding de linha
const HEIGHT = 32; // ~ mesma altura do bloco de rodapé (2 linhas de texto)

async function main() {
  const { data, info } = await sharp("public/logo.png")
    .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // funde alpha com fundo branco
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== WIDTH || info.height !== HEIGHT) {
    throw new Error(`Tamanho inesperado: ${info.width}x${info.height}`);
  }

  const bytesPerRow = WIDTH / 8;
  const packed = new Uint8Array(bytesPerRow * HEIGHT);
  const THRESHOLD = 160; // abaixo disso conta como "preto" (imprime o ponto)

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const gray = data[y * WIDTH + x];
      const isBlack = gray < THRESHOLD;
      if (isBlack) {
        const byteIndex = y * bytesPerRow + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8); // MSB primeiro
        packed[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  const base64 = Buffer.from(packed).toString("base64");
  console.log(`WIDTH=${WIDTH} HEIGHT=${HEIGHT} BYTES_PER_ROW=${bytesPerRow} TOTAL_BYTES=${packed.length}`);
  writeFileSync("scripts/logo-bitmap.b64.txt", base64);
  console.log("Salvo em scripts/logo-bitmap.b64.txt");
}

main();
