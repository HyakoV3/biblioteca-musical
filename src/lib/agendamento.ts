// Agendamento das notas de UMA voz, no instrumento gravado (smplr) ou no sintetizado, a partir de uma posição em batidas.
import type { InstrumentoId, SinteticoId } from "./instrumentos";
import type { InstrumentoGravado } from "./gravados";
import { agendarNota } from "./sintese-nota";

export type Nota = [inicio: number, duracao: number, midi: number];
export type Voz = { nome: string; notas: Nota[] };

export type Opcoes = {
  andamento: number; // batidas por minuto
  transposicao: number; // semitons
  instrumentos: InstrumentoId[]; // um por voz
  volumes: number[]; // 0..1 por voz (0 = silenciada)
};

/**
 * As notas que ainda soam a partir de `batida`, com o tempo recontado desde esse ponto: as que terminaram antes
 * somem, as que atravessam o ponto começam em 0 com a duração que sobra, as demais só andam para trás.
 */
export function notasAPartirDe(notas: Nota[], batida: number): Nota[] {
  const ap = Number.isFinite(batida) ? Math.max(0, batida) : 0;
  if (ap === 0) return notas;
  const saida: Nota[] = [];
  for (const [inicio, dur, midi] of notas) {
    const fim = inicio + dur;
    if (fim <= ap + 1e-9) continue;
    saida.push(inicio >= ap ? [inicio - ap, dur, midi] : [0, fim - ap, midi]);
  }
  return saida;
}

/** O que o agendamento de uma voz precisa saber do pedido de `tocar`. */
export type Cena = {
  ctx: AudioContext;
  opcoes: Opcoes;
  aPartirDe: number;
  /** Segundos por batida. */
  seg: number;
  /** Instante, no relógio de `ctx`, em que o hino começa. */
  inicio: number;
  /** As ondas já criadas (uma por instrumento e altura). */
  ondas: Map<string, PeriodicWave>;
};

/** Posição e duração, em segundos do relógio do contexto, de uma nota em batidas. */
function quando(cena: Cena, t: number, dur: number): { ini: number; duracao: number } {
  return { ini: cena.inicio + t * cena.seg, duracao: Math.max(dur * cena.seg, 0.05) };
}

/** Agenda as notas de uma voz no instrumento gravado (o smplr agenda cada nota). Devolve o fim da última, em segundos desde o início. */
export function agendarGravada(cena: Cena, voz: Voz, real: InstrumentoGravado): number {
  let fim = 0;
  for (const [t, dur, midi] of notasAPartirDe(voz.notas, cena.aPartirDe)) {
    const { ini, duracao } = quando(cena, t, dur);
    real.start({ note: midi + cena.opcoes.transposicao, velocity: 90, time: ini, duration: duracao });
    fim = Math.max(fim, ini + duracao - cena.inicio);
  }
  return fim;
}

/** Agenda as notas de uma voz sintetizada. Devolve o fim da última (segundos desde o início) e as fontes, para quem chamou poder pará-las. */
export function agendarSintetizada(cena: Cena, voz: Voz, id: SinteticoId, destino: GainNode): { fim: number; fontes: AudioScheduledSourceNode[] } {
  let fim = 0;
  const fontes: AudioScheduledSourceNode[] = [];
  for (const [t, dur, midi] of notasAPartirDe(voz.notas, cena.aPartirDe)) {
    const { ini, duracao } = quando(cena, t, dur);
    fontes.push(...agendarNota(cena.ctx, cena.ondas, destino, { id, midi: midi + cena.opcoes.transposicao, ini, dur: duracao }));
    fim = Math.max(fim, ini + duracao - cena.inicio);
  }
  return { fim, fontes };
}
