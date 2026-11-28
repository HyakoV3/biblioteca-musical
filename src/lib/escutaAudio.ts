// As peças de áudio da captura do microfone (ver `escuta.ts`): o contexto, o pedido do microfone e a leitura periódica de uma janela de amostras.
import { JANELA, Medidor, type Bruta } from "./detector";

/** De quanto em quanto a janela é lida (ms). */
export const PASSO_MS = 50;

/** Falha se o aparelho não tem microfone (antes de criar qualquer coisa). */
export function exigirMicrofone(): void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new DOMException("sem microfone", "NotSupportedError");
}

/** Cria o contexto de áudio, já, no toque: o navegador só deixa o áudio iniciar depois de um gesto. Falha se não há áudio. */
export function criarContextoDeEscuta(): AudioContext {
  const Contexto = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Contexto) throw new DOMException("sem áudio", "NotSupportedError");
  return new Contexto();
}

/** Pede o microfone SEM os filtros do aparelho. Se falha, fecha o `contexto` e repassa o erro. */
export async function pedirMicrofone(contexto: AudioContext): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  } catch (e) {
    void contexto.close().catch(() => {});
    throw e;
  }
}

/** Liga o fluxo a um analisador e lê uma janela a cada `PASSO_MS`, entregando a leitura bruta a `aoLer`. Devolve o temporizador. */
export function iniciarLeitura(contexto: AudioContext, fluxo: MediaStream, aoLer: (b: Bruta | null) => void): ReturnType<typeof setInterval> {
  void contexto.resume().catch(() => {});
  const analisador = contexto.createAnalyser();
  analisador.fftSize = JANELA;
  contexto.createMediaStreamSource(fluxo).connect(analisador);
  const amostras = new Float32Array(analisador.fftSize);
  const medidor = new Medidor();
  return setInterval(() => {
    analisador.getFloatTimeDomainData(amostras);
    aoLer(medidor.medir(amostras, contexto.sampleRate));
  }, PASSO_MS);
}

/** Para as faixas do microfone e fecha o contexto. */
export function soltarMicrofone(fluxo: MediaStream, contexto: AudioContext): void {
  fluxo.getTracks().forEach((t) => t.stop());
  void contexto.close().catch(() => {});
}
