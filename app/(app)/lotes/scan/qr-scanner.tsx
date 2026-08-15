"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Extrai o id do lote tanto de uma URL completa (QR impresso: fbgestao.com/lotes/xxx)
// quanto de um código "cru" (se algum QR só tiver o id, por compatibilidade).
function extrairLoteId(texto: string): string | null {
  const trimmed = texto.trim();
  try {
    const url = new URL(trimmed);
    const partes = url.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("lotes");
    if (i >= 0 && partes[i + 1]) return partes[i + 1];
  } catch {
    /* não é uma URL — segue pro fallback abaixo */
  }
  if (/^[a-z0-9]{10,40}$/i.test(trimmed)) return trimmed;
  return null;
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameId: number;
    let parou = false;

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (parou) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setAtivo(true);
        }
        tick();
      } catch (e) {
        setErro(
          "Não consegui acessar a câmera" +
            (e instanceof Error ? `: ${e.message}` : "") +
            ". Digite o código manualmente abaixo.",
        );
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            const id = extrairLoteId(code.data);
            if (id) {
              parou = true;
              stream?.getTracks().forEach((t) => t.stop());
              router.push(`/lotes/${id}`);
              return;
            }
          }
        }
      }
      if (!parou) frameId = requestAnimationFrame(tick);
    }

    iniciar();
    return () => {
      parou = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  function irManual() {
    const id = extrairLoteId(manual);
    if (!id) {
      setErro("Código inválido.");
      return;
    }
    router.push(`/lotes/${id}`);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-lg border bg-black">
        <video ref={videoRef} className="w-full" muted playsInline />
        {!ativo && !erro && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
            Abrindo câmera…
          </p>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex w-full max-w-sm flex-col gap-1">
        <Label htmlFor="manual" className="text-xs">
          Ou digite/cole o código do lote
        </Label>
        <div className="flex gap-2">
          <Input
            id="manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Código do lote"
            className="h-10"
          />
          <Button onClick={irManual} className="h-10">
            Ir
          </Button>
        </div>
      </div>
    </div>
  );
}
