/**
 * Imprime a via num iframe escondido — a tela já pode ir pro quadro sem
 * esperar o diálogo de impressão. O iframe fica no <body> (fora do React), então
 * sobrevive à navegação; some sozinho depois de imprimir.
 */
export function imprimirViaEmSegundoPlano(vendaId: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:200px;border:0";
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  f.src = `/pdv-cupom/${vendaId}?imprimir=iframe`;
  const remover = () => f.remove();
  window.addEventListener("message", function ok(e) {
    if (e.data === `pdv-impresso:${vendaId}`) {
      window.removeEventListener("message", ok);
      setTimeout(remover, 1000);
    }
  });
  setTimeout(remover, 120_000);
  document.body.appendChild(f);
}
