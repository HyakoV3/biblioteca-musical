// O som do clique do metrônomo (I-20): o timbre de cada tempo do compasso e o agendamento/cancelamento dos osciladores no relógio de áudio.
import type { Clique } from "./metronomoAgenda";

/** Timbre do clique: o forte é mais agudo e mais alto (a diferença se confere pelo `hz` no teste, e se ouve). */
export const CLIQUE_FORTE = { hz: 1600, ganho: 0.7 };
export const CLIQUE_FRACO = { hz: 1000, ganho: 0.45 };
/** Nos compostos (6, 9 e 12), o 1º clique de cada grupo de 3 (o tempo pontuado) soa entre o forte e o fraco: sem ele, 6/8 soaria como 6/4 simples. */
export const CLIQUE_MEDIO = { hz: 1250, ganho: 0.55 };

/** Compasso composto: os cliques (colcheias) vão de 3 em 3. */
export const ehComposto = (compasso: number): boolean => compasso >= 6 && compasso % 3 === 0;

/** O timbre do clique de `indice` (0 = o 1º tempo do compasso) num compasso de `compasso` cliques. */
export function perfilDoClique(indice: number, compasso: number) {
  if (indice === 0) return CLIQUE_FORTE;
  return ehComposto(compasso) && indice % 3 === 0 ? CLIQUE_MEDIO : CLIQUE_FRACO;
}
const ATAQUE = 0.002;
const DURACAO = 0.05;

/** Quanto o som demora a sair do aparelho depois de agendado (s), para a bolinha não adiantar o clique (fone Bluetooth: 100 a 300 ms). */
export function atrasoDeSaida(ctx: Pick<AudioContext, "state" | "outputLatency">): number {
  const l = ctx.outputLatency;
  return ctx.state === "running" && Number.isFinite(l) ? Math.max(0, l) : 0;
}

export type Agendado = { osc: OscillatorNode; ganho: GainNode; tempo: number };

export function soarClique(ctx: AudioContext, c: Clique, compasso: number): Agendado {
  const perfil = perfilDoClique(c.indice, compasso);
  const osc = ctx.createOscillator();
  osc.frequency.value = perfil.hz;
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(0, c.tempo);
  ganho.gain.linearRampToValueAtTime(perfil.ganho, c.tempo + ATAQUE);
  ganho.gain.exponentialRampToValueAtTime(0.0001, c.tempo + DURACAO);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(c.tempo);
  osc.stop(c.tempo + DURACAO + 0.01);
  return { osc, ganho, tempo: c.tempo };
}

/** Cancela os cliques agendados que ainda não soaram (`agora`: o relógio de áudio). */
export function cancelarAgendados(agendados: readonly Agendado[], agora: number): void {
  for (const a of agendados) {
    if (a.tempo <= agora) continue; // já soou (ou está soando): deixa terminar
    // Desconecta primeiro (isso garante o silêncio) e isola o `stop`: ele já foi chamado em `soarClique()` e, em WebKit antigo, uma segunda chamada lança.
    try {
      a.ganho.disconnect();
      a.osc.disconnect();
    } catch {
      // já desconectado
    }
    try {
      a.osc.stop(0); // parar antes de começar: o clique agendado nunca soa
    } catch {
      // já tinha parado
    }
  }
}
