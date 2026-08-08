"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "./use-camera";
import { detectDescriptor, loadFaceApi } from "@/lib/face-recognition";
import { registerFacialPonto } from "./actions";

type Feedback = { kind: "ok" | "done" | "unknown" | "error"; text: string } | null;

const FEEDBACK_STYLES: Record<NonNullable<Feedback>["kind"], string> = {
  ok: "bg-emerald-600",
  done: "bg-amber-500",
  unknown: "bg-neutral-700",
  error: "bg-destructive",
};

export function TotemKiosk() {
  const { videoRef, ready, error } = useCamera();
  const [modelsReady, setModelsReady] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef(0);

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
        const result = await registerFacialPonto(descriptor);
        if (result.status === "ok") {
          setFeedback({ kind: "ok", text: `${result.employeeName} — ${result.action} às ${result.time}` });
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
    const timeout = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-[3/4] w-full scale-x-[-1] object-cover" muted playsInline />
        {feedback && (
          <div
            className={`absolute inset-x-0 bottom-0 p-4 text-center text-lg font-semibold text-white ${FEEDBACK_STYLES[feedback.kind]}`}
          >
            {feedback.kind === "ok" && "✅ "}
            {feedback.kind === "done" && "ℹ️ "}
            {feedback.kind === "error" && "⚠️ "}
            {feedback.text}
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
