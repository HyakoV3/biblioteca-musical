// A captura do microfone de "Qual nota é essa?": abre o microfone SEM filtros do aparelho (eco, supressão de ruído e ganho automático desligados, que estragam a altura de uma nota
// sustentada), lê uma janela de `JANELA` amostras a cada ~50 ms e entrega a leitura bruta a quem chamou. Nada é gravado e nada sai do aparelho. `parar()` solta o microfone e fecha o áudio.
import type { Bruta } from "./detector";
import { criarContextoDeEscuta, exigirMicrofone, iniciarLeitura, pedirMicrofone } from "./escutaAudio";

export class Escuta {
  private fluxo: MediaStream | null = null;
  private contexto: AudioContext | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private numero = 0;

  get ligada(): boolean {
    return this.relogio !== null;
  }

  /** Abre o microfone (chamar a partir de um toque). `aoLer` recebe a leitura de cada janela, ou nulo se não há som para medir; `aoPerder` avisa quando o sistema tira o microfone (permissão revogada, aparelho desconectado, outro app o toma). Rejeita se não há microfone ou a permissão foi negada. */
  async iniciar(aoLer: (b: Bruta | null) => void, aoPerder?: () => void): Promise<void> {
    if (this.ligada) return;
    exigirMicrofone();
    const meu = ++this.numero;
    const contexto = criarContextoDeEscuta();
    const fluxo = await pedirMicrofone(contexto);
    if (meu !== this.numero) {
      // `parar()` veio enquanto a permissão era pedida
      fluxo.getTracks().forEach((t) => t.stop());
      void contexto.close();
      return;
    }
    this.fluxo = fluxo;
    this.contexto = contexto;
    this.vigiarFaixas(fluxo, meu, aoPerder);
    this.relogio = iniciarLeitura(contexto, fluxo, aoLer);
  }

  /** Avisa (`aoPerder`) quando o sistema encerra o microfone. `ended` não dispara no `stop()` do próprio `parar()`: sem laço. */
  private vigiarFaixas(fluxo: MediaStream, meu: number, aoPerder?: () => void): void {
    for (const faixa of fluxo.getAudioTracks()) {
      faixa.addEventListener(
        "ended",
        () => {
          if (meu !== this.numero) return;
          this.parar();
          aoPerder?.();
        },
        { once: true },
      );
    }
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
