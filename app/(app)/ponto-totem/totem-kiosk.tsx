"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "./use-camera";
import { detectDescriptor, loadFaceApi } from "@/lib/face-recognition";
import { registerFacialPonto } from "./actions";

type Feedback = { kind: "ok" | "done" | "unknown" | "error"; text: string; aviso?: string } | null;

const FEEDBACK_STYLES: Record<NonNullable<Feedback>["kind"], string> = {
  ok: "bg-emerald-600",
  done: "bg-amber-500",
  unknown: "bg-neutral-700",
  error: "bg-destructive",
};

/** Tira um "print" pequeno do vídeo pra guardar como prova da batida. */
function capturePhoto(video: HTMLVideoElement): string | undefined {
  const width = 240;
  const height = video.videoHeight
    ? Math.round((video.videoHeight / video.videoWidth) * width)
    : 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

// Tempo pra tocar em Intervalo/Saída; sem toque, nada é registrado.
const ESCOLHA_MS = 15000;

type Escolha = { employeeName: string; descriptor: number[]; photo?: string };

export function TotemKiosk() {
  const { videoRef, ready, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef(0);
  const [escolha, setEscolha] = useState<Escolha | null>(null);

  useEffect(() => {
    loadFaceApi()
      .then(() => setModelsReady(true))
      .catch(() => setFeedback({ kind: "error", text: "Falha ao carregar o reconhecimento facial." }));
  }, []);

  useEffect(() => {
    if (!ready || !modelsReady) return;
    const interval = setInterval(async () => {
      if (busyRef.current || Date.now() < cooldownRef.current || !videoRef.current) return;
      busyRef.current = true;
      try {
        const descriptor = await detectDescriptor(videoRef.current);
        if (!descriptor) return;
        const photo = capturePhoto(videoRef.current);
        const result = await registerFacialPonto(descriptor, photo);
        if (result.status === "choose") {
          setFeedback(null);
          setEscolha({ employeeName: result.employeeName, descriptor, photo });
          cooldownRef.current = Date.now() + ESCOLHA_MS;
        } else if (result.status === "ok") {
          setFeedback({
            kind: "ok",
            text: `${result.employeeName} — ${result.action} às ${result.time}`,
            aviso: result.aviso,
          });
          cooldownRef.current = Date.now() + (result.aviso ? 12000 : 6000);
        } else if (result.status === "recent") {
          setFeedback({ kind: "done", text: `${result.employeeName}, seu ponto acabou de ser registrado.` });
          cooldownRef.current = Date.now() + 6000;
        } else if (result.status === "done") {
          setFeedback({ kind: "done", text: `${result.employeeName}, você já registrou entrada e saída hoje.` });
          cooldownRef.current = Date.now() + 6000;
        } else if (result.status === "error") {
          setFeedback({ kind: "error", text: result.message });
          cooldownRef.current = Date.now() + 4000;
        }
        // "unknown" (rosto não reconhecido) — segue escaneando, sem alarde.
      } finally {
        busyRef.current = false;
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [ready, modelsReady, videoRef]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), feedback.aviso ? 12000 : 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!escolha) return;
    const timeout = setTimeout(() => setEscolha(null), ESCOLHA_MS);
    return () => clearTimeout(timeout);
  }, [escolha]);

  async function confirmar(tipo: "intervalo" | "saida") {
    if (!escolha) return;
    const { descriptor, photo } = escolha;
    setEscolha(null);
    const result = await registerFacialPonto(descriptor, photo, tipo);
    if (result.status === "ok") {
      setFeedback({ kind: "ok", text: `${result.employeeName} — ${result.action} às ${result.time}` });
    } else {
      setFeedback({
        kind: "error",
        text: result.status === "error" ? result.message : "Não foi possível registrar. Tente de novo.",
      });
    }
    cooldownRef.current = Date.now() + 6000;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-[3/4] w-full scale-x-[-1] object-cover" muted playsInline />
        {escolha && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-neutral-900/95 p-4 text-center text-white">
            <p className="text-lg font-semibold">{escolha.employeeName}, o que vai fazer?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => confirmar("intervalo")}
                className="rounded-lg bg-amber-500 p-5 text-xl font-bold text-black"
              >
                Intervalo
              </button>
              <button
                type="button"
                onClick={() => confirmar("saida")}
                className="rounded-lg bg-destructive p-5 text-xl font-bold text-white"
              >
                Saída
              </button>
            </div>
          </div>
        )}
        {feedback && (
          <div
            className={`absolute inset-x-0 bottom-0 p-4 text-center text-lg font-semibold text-white ${FEEDBACK_STYLES[feedback.kind]}`}
          >
            {feedback.kind === "ok" && "✅ "}
            {feedback.kind === "done" && "ℹ️ "}
            {feedback.kind === "error" && "⚠️ "}
            {feedback.text}
            {feedback.aviso && (
              <p className="mt-2 rounded bg-amber-400 p-2 text-base text-black">⚠️ {feedback.aviso}</p>
            )}
          </div>
        )}
      </div>
      <p className="text-center text-sm text-neutral-500">
        {error
          ? error
          : !modelsReady
            ? "Carregando reconhecimento facial…"
            : !ready
              ? "Abrindo a câmera…"
              : "Posicione o rosto na câmera pra bater o ponto."}
      </p>
    </div>
  );
}
