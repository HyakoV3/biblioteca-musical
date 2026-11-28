// Liga o filtro neural de ruído entre o microfone e o gravador (fonte → filtro → destino) dentro do contexto de áudio do gravador.

import { TAXA_NEURAL } from "./filtroDeRuido";
import type { NoDeFiltro } from "./ruido";

type NoComFim = AudioNode & { destroy?: () => void };
/** Os nós que o filtro neural deixa ligados: o gravador grava a saída do `destino`. */
export type NosDoFiltro = { fonte: AudioNode; filtro: NoComFim; destino: MediaStreamAudioDestinationNode };
/** O que já foi criado no meio do caminho, para desfazer se algo falhar. */
type Parcial = { fonte?: AudioNode; filtro?: NoDeFiltro };

/** Desfaz as ligações (se já estavam desfeitas, não faz mal). */
export function desligarNos(fonte: AudioNode | undefined, filtro: NoComFim | undefined): void {
  try {
    fonte?.disconnect();
    filtro?.disconnect();
    filtro?.destroy?.();
  } catch {
    /* já desligado */
  }
}

/**
 * Carrega o filtro e espera o contexto rodar (senão a gravação sairia muda: espera um pouco e, se não der, o microfone vai direto). Nulo se `valido` deixou
 * de valer (um `soltar` aconteceu no meio): aí nada fica ligado.
 */
async function carregarFiltro(ctx: AudioContext, qual: "rnnoise" | "gtcrn", valido: () => boolean, parcial: Parcial): Promise<NoDeFiltro | null> {
  const { criarFiltro } = await import("./ruido");
  const filtro = (parcial.filtro = await criarFiltro(ctx, qual));
  if (!valido()) {
    filtro.destroy();
    return null;
  }
  if (ctx.state !== "running") await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  if (!valido()) {
    filtro.destroy();
    return null;
  }
  if (ctx.state !== "running") throw new Error("o contexto de áudio não está rodando");
  return filtro;
}

/**
 * Devolve os nós ligados, ou nulo se não deu (sem contexto de 48 kHz, sem AudioWorklet, arquivo que não carrega, ou `valido()` falso): nada fica ligado
 * pela metade e a gravação segue sem filtro.
 */
export async function ligarFiltroNeural(ctx: AudioContext | null, mic: MediaStream | null, qual: "rnnoise" | "gtcrn", valido: () => boolean): Promise<NosDoFiltro | null> {
  if (!ctx || !mic || ctx.sampleRate !== TAXA_NEURAL) {
    console.warn("gravador: sem contexto de 48 kHz para o filtro de ruído; gravando sem filtro");
    return null;
  }
  const parcial: Parcial = {};
  try {
    const filtro = await carregarFiltro(ctx, qual, valido, parcial);
    if (!filtro) return null;
    const fonte = (parcial.fonte = ctx.createMediaStreamSource(mic));
    const destino = ctx.createMediaStreamDestination();
    fonte.connect(filtro);
    filtro.connect(destino);
    return { fonte, filtro, destino };
  } catch (e) {
    console.warn(`gravador: não foi possível ligar o filtro de ruído ${qual}; gravando sem filtro`, e);
    desligarNos(parcial.fonte, parcial.filtro);
    return null;
  }
}
