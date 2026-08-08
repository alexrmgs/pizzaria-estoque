// Utilitários de reconhecimento facial que rodam 100% no navegador.
// A biblioteca é importada dinamicamente (só no cliente) pra não quebrar a
// renderização no servidor, que não tem `window`/câmera.
import type * as FaceApi from "@vladmandic/face-api";

let faceapi: typeof FaceApi | null = null;
let modelsLoaded = false;

export async function loadFaceApi(): Promise<typeof FaceApi> {
  if (!faceapi) {
    faceapi = await import("@vladmandic/face-api");
  }
  if (!modelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    modelsLoaded = true;
  }
  return faceapi;
}

/** Detecta um rosto no vídeo e devolve o descritor (128 números) ou null se
 * não achou rosto nenhum. */
export async function detectDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
  const api = await loadFaceApi();
  const result = await api
    .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;
  return Array.from(result.descriptor);
}
