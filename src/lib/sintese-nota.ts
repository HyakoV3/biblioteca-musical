// Uma nota sintetizada com Web Audio: oscilador, filtro de abertura nos metais, envoltória e vibrato.
// Serve ao app (AudioContext) e às prévias geradas offline (OfflineAudioContext).
import type { Perfil, SinteticoId } from "./instrumentos";
import { perfilDaNota } from "./timbres";

/** As ondas já criadas, por (instrumento, altura). */
export type Ondas = Map<string, PeriodicWave>;

/** Do início ao fim da nota, em segundos do relógio do contexto. */
type Janela = { ini: number; fim: number };

export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A nota a agendar. `midi` é a altura que SOA (já transposta); `ini` e `dur` estão em segundos do relógio do contexto. */
export type NotaSintetica = { id: SinteticoId; midi: number; ini: number; dur: number };

/** Onda da nota: cada (instrumento, altura) tem a sua tabela de harmônicos, e criá-la a cada nota seria desperdício. */
function ondaDaNota(ctx: BaseAudioContext, ondas: Ondas, chave: string, harmonicos: number[]): PeriodicWave {
  let onda = ondas.get(chave);
  if (!onda) {
    onda = ctx.createPeriodicWave(new Float32Array(harmonicos.length), Float32Array.from(harmonicos));
    ondas.set(chave, onda);
  }
  return onda;
}

/** Ataque, sustentação e solta do ganho da nota. */
function agendarEnvoltoria(env: GainNode, perfil: Perfil, { ini, fim: fimNota }: Janela): void {
  const ataque = Math.min(perfil.ataque, (fimNota - ini) / 2);
  env.gain.setValueAtTime(0, ini);
  env.gain.linearRampToValueAtTime(perfil.nivel, ini + ataque);
  env.gain.setValueAtTime(perfil.nivel, Math.max(ini + ataque, fimNota - perfil.solta));
  env.gain.linearRampToValueAtTime(0, fimNota);
}

/** Metais: o brilho nasce fechado e abre em poucas dezenas de milissegundos (passa-baixa de 2ª ordem). Devolve o filtro, ainda sem ligações. */
function criarFiltroDeAbertura(ctx: BaseAudioContext, abertura: { corte: number; tempo: number }, f0: number, ini: number): BiquadFilterNode {
  const teto = ctx.sampleRate * 0.45;
  const filtro = ctx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.Q.value = 20 * Math.log10(Math.SQRT1_2); // no lowpass do Web Audio o Q é em dB: -3,01 dB = Butterworth, sem pico (o modelo medido)
  const de = Math.min(teto, abertura.corte * f0);
  filtro.frequency.setValueAtTime(de, ini);
  filtro.frequency.exponentialRampToValueAtTime(teto, ini + abertura.tempo);
  return filtro;
}

/** O vibrato entra devagar, depois do atraso: notas curtas quase não o recebem. Devolve o LFO, já agendado. */
function agendarVibrato(ctx: BaseAudioContext, vibrato: NonNullable<Perfil["vibrato"]>, osc: OscillatorNode, { ini, fim: fimNota }: Janela): OscillatorNode {
  const lfo = ctx.createOscillator();
  const prof = ctx.createGain();
  lfo.frequency.value = vibrato.hz;
  prof.gain.setValueAtTime(0, ini);
  prof.gain.setValueAtTime(0, ini + vibrato.atraso);
  prof.gain.linearRampToValueAtTime(vibrato.cents, ini + vibrato.atraso + 0.25);
  lfo.connect(prof).connect(osc.detune);
  lfo.start(ini);
  lfo.stop(fimNota + 0.02);
  return lfo;
}

/**
 * Agenda UMA nota sintetizada e devolve as fontes, para quem chamou poder pará-las. `ondas` guarda as ondas já criadas.
 */
export function agendarNota(ctx: BaseAudioContext, ondas: Ondas, destino: AudioNode, nota: NotaSintetica): AudioScheduledSourceNode[] {
  const { id, midi, ini, dur } = nota;
  const perfil = perfilDaNota(id, midi);
  const onda = ondaDaNota(ctx, ondas, `${id}:${Math.round(midi)}`, perfil.harmonicos);
  const f0 = frequencia(midi);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.setPeriodicWave(onda);
  osc.frequency.value = f0;
  const janela: Janela = { ini, fim: ini + Math.max(dur, 0.05) };
  agendarEnvoltoria(env, perfil, janela);
  const entrada: AudioNode = perfil.abertura ? osc.connect(criarFiltroDeAbertura(ctx, perfil.abertura, f0, ini)) : osc;
  entrada.connect(env).connect(destino);
  const fontes: AudioScheduledSourceNode[] = [osc];
  if (perfil.vibrato) fontes.push(agendarVibrato(ctx, perfil.vibrato, osc, janela));

  osc.start(ini);
  osc.stop(janela.fim + 0.02);
  return fontes;
}
