// A captura do microfone de "Qual nota é essa?": abre o microfone SEM filtros do aparelho (eco, supressão de ruído e ganho automático desligados, que estragam a altura de uma nota
// sustentada), lê uma janela de `JANELA` amostras a cada ~50 ms e entrega a leitura bruta a quem chamou. Nada é gravado e nada sai do aparelho. `parar()` solta o microfone e fecha o áudio.
import { JANELA, Medidor, type Bruta } from "./detector";

const PASSO_MS = 50;

export class Escuta {
  private fluxo: MediaStream | null = null;
  private contexto: AudioContext | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private numero = 0;

  get ligada(): boolean {
    return this.relogio !== null;
  }

  /** Abre o microfone (chamar a partir de um toque). `aoLer` recebe a leitura de cada janela, ou nulo se não há som para medir. Rejeita se não há microfone ou a permissão foi negada. */
  async iniciar(aoLer: (b: Bruta | null) => void): Promise<void> {
    if (this.ligada) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new DOMException("sem microfone", "NotSupportedError");
    const meu = ++this.numero;
    const Contexto = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) throw new DOMException("sem áudio", "NotSupportedError");
    const contexto = new Contexto(); // nasce já, no toque: o navegador só deixa o áudio iniciar depois de um gesto
    let fluxo: MediaStream;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) {
      void contexto.close();
      throw e;
    }
    if (meu !== this.numero) {
      // `parar()` veio enquanto a permissão era pedida
      fluxo.getTracks().forEach((t) => t.stop());
      void contexto.close();
      return;
    }
    this.fluxo = fluxo;
    this.contexto = contexto;
    void contexto.resume().catch(() => {});
    const analisador = contexto.createAnalyser();
    analisador.fftSize = JANELA;
    contexto.createMediaStreamSource(fluxo).connect(analisador);
    const amostras = new Float32Array(analisador.fftSize);
    const medidor = new Medidor();
    this.relogio = setInterval(() => {
      analisador.getFloatTimeDomainData(amostras);
      aoLer(medidor.medir(amostras, contexto.sampleRate));
    }, PASSO_MS);
  }

  /** Solta o microfone e devolve o áudio ao aparelho. */
  parar(): void {
    this.numero++;
    if (this.relogio !== null) clearInterval(this.relogio);
    this.relogio = null;
    this.fluxo?.getTracks().forEach((t) => t.stop());
    this.fluxo = null;
    void this.contexto?.close().catch(() => {});
    this.contexto = null;
  }
}
