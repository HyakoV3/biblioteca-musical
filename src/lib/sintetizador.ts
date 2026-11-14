// Sintetizador simples com Web Audio: toca notas (MIDI) de várias vozes.
// Não usa gravações: tudo é gerado a partir dos eventos de nota do pacote.
import { INSTRUMENTOS, PADRAO, type InstrumentoId, type Perfil } from "./instrumentos";

export type Nota = [inicio: number, duracao: number, midi: number];
export type Voz = { nome: string; notas: Nota[] };

export type Opcoes = {
  andamento: number; // batidas por minuto
  transposicao: number; // semitons
  instrumentos: InstrumentoId[]; // um por voz
  volumes: number[]; // 0..1 por voz (0 = silenciada)
};

export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Sintetizador {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private ganhos: GainNode[] = [];
  private fontes: AudioScheduledSourceNode[] = [];
  private ondas = new Map<InstrumentoId, PeriodicWave>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  tocando = false;

  private onda(ctx: AudioContext, id: InstrumentoId, perfil: Perfil): PeriodicWave {
    let w = this.ondas.get(id);
    if (!w) {
      w = ctx.createPeriodicWave(new Float32Array(perfil.harmonicos.length), Float32Array.from(perfil.harmonicos));
      this.ondas.set(id, w);
    }
    return w;
  }

  async tocar(vozes: Voz[], opcoes: Opcoes, aoTerminar: () => void) {
    this.parar();
    this.ctx ??= new AudioContext();
    // Em iOS/WebView o áudio só inicia após um gesto do usuário (clique em "Tocar").
    await this.ctx.resume();
    const ctx = this.ctx;

    // Compressor no fim da cadeia: várias vozes somadas não estouram o volume.
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    this.mestre = ctx.createGain();
    this.mestre.gain.value = 0.9;
    this.mestre.connect(compressor);
    // Todas as vozes são agendadas; silenciar é só baixar o volume da voz (vale ao vivo).
    this.ganhos = vozes.map((_, i) => {
      const g = ctx.createGain();
      g.gain.value = opcoes.volumes[i] ?? 1;
      g.connect(this.mestre!);
      return g;
    });

    const seg = 60 / Math.max(opcoes.andamento, 1); // segundos por batida
    const inicio = ctx.currentTime + 0.1;
    let fim = 0;

    vozes.forEach((voz, i) => {
      const id = opcoes.instrumentos[i] && opcoes.instrumentos[i] in INSTRUMENTOS ? opcoes.instrumentos[i] : PADRAO;
      const perfil: Perfil = INSTRUMENTOS[id];
      const onda = this.onda(ctx, id, perfil);
      for (const [t, dur, midi] of voz.notas) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.setPeriodicWave(onda);
        osc.frequency.value = frequencia(midi + opcoes.transposicao);
        const ini = inicio + t * seg;
        const fimNota = ini + Math.max(dur * seg, 0.05);
        const ataque = Math.min(perfil.ataque, (fimNota - ini) / 2);
        env.gain.setValueAtTime(0, ini);
        env.gain.linearRampToValueAtTime(perfil.nivel, ini + ataque);
        env.gain.setValueAtTime(perfil.nivel, Math.max(ini + ataque, fimNota - perfil.solta));
        env.gain.linearRampToValueAtTime(0, fimNota);
        osc.connect(env).connect(this.ganhos[i]);

        if (perfil.vibrato) {
          // O vibrato entra devagar, depois do atraso: notas curtas quase não o recebem.
          const lfo = ctx.createOscillator();
          const prof = ctx.createGain();
          lfo.frequency.value = perfil.vibrato.hz;
          prof.gain.setValueAtTime(0, ini);
          prof.gain.setValueAtTime(0, ini + perfil.vibrato.atraso);
          prof.gain.linearRampToValueAtTime(perfil.vibrato.cents, ini + perfil.vibrato.atraso + 0.25);
          lfo.connect(prof).connect(osc.detune);
          lfo.start(ini);
          lfo.stop(fimNota + 0.02);
          this.fontes.push(lfo);
        }

        osc.start(ini);
        osc.stop(fimNota + 0.02);
        this.fontes.push(osc);
        fim = Math.max(fim, fimNota - inicio);
      }
    });

    this.tocando = true;
    this.temporizador = setTimeout(() => {
      this.tocando = false;
      aoTerminar();
    }, (fim + 0.3) * 1000);
  }

  /** Ajusta o volume de uma voz enquanto toca (0 silencia). */
  volume(voz: number, valor: number) {
    const g = this.ganhos[voz];
    if (g && this.ctx) g.gain.setTargetAtTime(valor, this.ctx.currentTime, 0.015);
  }

  parar() {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    for (const o of this.fontes) {
      try {
        o.stop();
      } catch {
        /* já parado */
      }
    }
    this.fontes = [];
    this.ganhos = [];
    this.mestre?.disconnect();
    this.mestre = null;
    this.tocando = false;
  }
}
