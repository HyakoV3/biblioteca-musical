// Sintetizador simples com Web Audio: toca notas (MIDI) de várias vozes.
// Não usa gravações: tudo é gerado a partir dos eventos de nota do pacote.

export type Nota = [inicio: number, duracao: number, midi: number];
export type Voz = { nome: string; notas: Nota[] };

export type Timbre = "orgao" | "flauta" | "metal" | "teclado";

type Perfil = {
  nome: string;
  /** Amplitudes dos harmônicos (índice 0 é ignorado). Sem isso, usa a onda `onda`. */
  harmonicos?: number[];
  onda?: OscillatorType;
  ataque: number; // segundos
  solta: number; // segundos
  nivel: number; // volume geral do timbre (equilibra a sensação de volume)
};

export const TIMBRES: Record<Timbre, Perfil> = {
  orgao: { nome: "Órgão", harmonicos: [0, 1, 0.5, 0.35, 0.25, 0.15, 0.1, 0.07], ataque: 0.03, solta: 0.09, nivel: 0.2 },
  flauta: { nome: "Flauta", harmonicos: [0, 1, 0.12, 0.04], ataque: 0.06, solta: 0.1, nivel: 0.3 },
  metal: { nome: "Metal", harmonicos: [0, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1], ataque: 0.02, solta: 0.05, nivel: 0.1 },
  teclado: { nome: "Teclado", onda: "triangle", ataque: 0.02, solta: 0.06, nivel: 0.25 },
};

export type Opcoes = {
  andamento: number; // batidas por minuto
  transposicao: number; // semitons
  timbre: Timbre;
  volumes: number[]; // 0..1 por voz (0 = silenciada)
};

export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Sintetizador {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private ganhos: GainNode[] = [];
  private osciladores: OscillatorNode[] = [];
  private ondas = new Map<Timbre, PeriodicWave>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  tocando = false;

  private onda(ctx: AudioContext, t: Timbre): PeriodicWave | null {
    const h = TIMBRES[t].harmonicos;
    if (!h) return null;
    let w = this.ondas.get(t);
    if (!w) {
      w = ctx.createPeriodicWave(new Float32Array(h.length), Float32Array.from(h));
      this.ondas.set(t, w);
    }
    return w;
  }

  async tocar(vozes: Voz[], opcoes: Opcoes, aoTerminar: () => void) {
    this.parar();
    this.ctx ??= new AudioContext();
    // Em iOS/WebView o áudio só inicia após um gesto do usuário (clique em "Tocar").
    await this.ctx.resume();
    const ctx = this.ctx;
    const perfil = TIMBRES[opcoes.timbre];
    const onda = this.onda(ctx, opcoes.timbre);

    this.mestre = ctx.createGain();
    this.mestre.gain.value = perfil.nivel;
    this.mestre.connect(ctx.destination);
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
      for (const [t, dur, midi] of voz.notas) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        if (onda) osc.setPeriodicWave(onda);
        else osc.type = perfil.onda ?? "triangle";
        osc.frequency.value = frequencia(midi + opcoes.transposicao);
        const ini = inicio + t * seg;
        const fimNota = ini + Math.max(dur * seg, 0.05);
        const ataque = Math.min(perfil.ataque, (fimNota - ini) / 2);
        env.gain.setValueAtTime(0, ini);
        env.gain.linearRampToValueAtTime(1, ini + ataque);
        env.gain.setValueAtTime(1, Math.max(ini + ataque, fimNota - perfil.solta));
        env.gain.linearRampToValueAtTime(0, fimNota);
        osc.connect(env).connect(this.ganhos[i]);
        osc.start(ini);
        osc.stop(fimNota + 0.02);
        this.osciladores.push(osc);
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
    for (const o of this.osciladores) {
      try {
        o.stop();
      } catch {
        /* já parado */
      }
    }
    this.osciladores = [];
    this.ganhos = [];
    this.mestre?.disconnect();
    this.mestre = null;
    this.tocando = false;
  }
}
