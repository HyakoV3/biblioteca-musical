// O tom de referência do afinador (I-13): uma nota SUSTENTADA, com o timbre `orgao_suave` (quase uma onda simples, sem vibrato, fácil de
// afinar de ouvido). Tem o seu PRÓPRIO `AudioContext`, criado no toque da pessoa. O hino toca num contexto privado do `Sintetizador` e a
// pausa dele é `ctx.suspend()`: um tom no mesmo contexto calaria justamente ao pausar o hino. Aqui só se reaproveita o PERFIL do timbre
// (harmônicos e tempos de entrada e saída), nunca o contexto.
import { INSTRUMENTOS } from "./instrumentos";

const PERFIL = INSTRUMENTOS.orgao_suave;
/** O volume 1 da tela é metade do fundo de escala: forte o bastante e sem estourar. */
const GANHO_MAXIMO = 0.5;

/** Só no servidor de desenvolvimento (e, portanto, no teste de ponta a ponta): deixa o teste MEDIR o som que o app gera. */
declare global {
  interface Window {
    __bmccbTom?: { analisador: AnalyserNode; readonly tocando: boolean; readonly frequencia: number };
  }
}

export class TomSustentado {
  private ctx: AudioContext | null = null;
  private onda: PeriodicWave | null = null;
  private osc: OscillatorNode | null = null;
  private env: GainNode | null = null;
  private hz = 0;

  /** Há uma nota soando (ou entrando)? */
  get tocando(): boolean {
    return this.osc !== null;
  }

  /**
   * Toca `frequencia` (Hz) até `parar()`. Se já havia uma nota, ela sai com a sua soltura enquanto a nova entra. Chamar a partir de um toque
   * da pessoa: o áudio só inicia depois de um gesto.
   */
  async tocar(frequencia: number, volume: number): Promise<void> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.onda = null; // a onda pertence ao contexto
    }
    const ctx = this.ctx;
    await ctx.resume();
    this.soltar();
    this.onda ??= ctx.createPeriodicWave(new Float32Array(PERFIL.harmonicos.length), Float32Array.from(PERFIL.harmonicos));
    const agora = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.onda);
    osc.frequency.value = frequencia;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, agora);
    env.gain.linearRampToValueAtTime(volume * GANHO_MAXIMO, agora + PERFIL.ataque);
    osc.connect(env).connect(ctx.destination);
    if (import.meta.env.DEV) this.sonda(ctx, env);
    osc.start(agora);
    this.osc = osc;
    this.env = env;
    this.hz = frequencia;
  }

  /** A nota sai com a sua soltura (sem estalo). */
  parar(): void {
    this.soltar();
  }

  /** Muda o volume da nota que soa, sem degrau. */
  volume(v: number): void {
    if (this.env && this.ctx) this.env.gain.setTargetAtTime(v * GANHO_MAXIMO, this.ctx.currentTime, 0.02);
  }

  /** Para a nota e devolve o áudio ao aparelho (fecha o contexto depois da soltura). */
  fechar(): void {
    this.soltar();
    const ctx = this.ctx;
    this.ctx = null;
    this.onda = null;
    if (ctx && ctx.state !== "closed") setTimeout(() => void ctx.close().catch(() => {}), (PERFIL.solta + 0.1) * 1000);
  }

  private soltar(): void {
    const { ctx, osc, env } = this;
    if (!ctx || !osc || !env) return;
    const t = ctx.currentTime;
    env.gain.cancelScheduledValues(t);
    env.gain.setValueAtTime(env.gain.value, t);
    env.gain.linearRampToValueAtTime(0, t + PERFIL.solta);
    osc.stop(t + PERFIL.solta + 0.02);
    this.osc = null;
    this.env = null;
  }

  private sonda(ctx: AudioContext, origem: AudioNode): void {
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 8192;
    origem.connect(analisador);
    const tom = this;
    window.__bmccbTom = {
      analisador,
      get tocando() {
        return tom.tocando;
      },
      get frequencia() {
        return tom.hz;
      },
    };
  }
}
