// Sintetizador simples com Web Audio: toca notas (MIDI) de várias vozes.
// Não usa gravações: tudo é gerado a partir dos eventos de nota do pacote.

export type Nota = [inicio: number, duracao: number, midi: number];
export type Voz = { nome: string; notas: Nota[] };
export type Opcoes = {
  andamento: number; // batidas por minuto
  transposicao: number; // semitons
  vozesAtivas: boolean[]; // uma entrada por voz
};

export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Sintetizador {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private osciladores: OscillatorNode[] = [];
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  tocando = false;

  async tocar(vozes: Voz[], opcoes: Opcoes, aoTerminar: () => void) {
    this.parar();
    this.ctx ??= new AudioContext();
    // Em iOS/WebView o áudio só inicia após um gesto do usuário (clique em "Tocar").
    await this.ctx.resume();
    const ctx = this.ctx;
    this.mestre = ctx.createGain();
    this.mestre.gain.value = 0.25;
    this.mestre.connect(ctx.destination);

    const seg = 60 / Math.max(opcoes.andamento, 1); // segundos por batida
    const inicio = ctx.currentTime + 0.1;
    let fim = 0;

    vozes.forEach((voz, i) => {
      if (!opcoes.vozesAtivas[i]) return;
      for (const [t, dur, midi] of voz.notas) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = frequencia(midi + opcoes.transposicao);
        const ini = inicio + t * seg;
        const fimNota = ini + Math.max(dur * seg, 0.05);
        env.gain.setValueAtTime(0, ini);
        env.gain.linearRampToValueAtTime(1, ini + 0.02);
        env.gain.setValueAtTime(1, Math.max(ini + 0.02, fimNota - 0.06));
        env.gain.linearRampToValueAtTime(0, fimNota);
        osc.connect(env).connect(this.mestre!);
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
    this.mestre?.disconnect();
    this.mestre = null;
    this.tocando = false;
  }
}
