// O lado de LEITURA do metrônomo (I-20): o andamento, o compasso, se está ligado e onde está a bolinha no instante visível. O controle (ligar, parar, agendar) fica em `Metronomo`.
import { BPM_PADRAO, COMPASSO_PADRAO, type Clique } from "./metronomoAgenda";
import { atrasoDeSaida } from "./metronomoClique";
import { ladoDoClique, posicaoDoPendulo, progressoNoCompasso, tempoAceso } from "./metronomoPosicao";

export class LeituraDoMetronomo {
  protected ctx: AudioContext | null = null;
  protected fila: Clique[] = [];
  protected _bpm = BPM_PADRAO;
  protected _compasso: number = COMPASSO_PADRAO;
  protected _ligado = false;

  get ligado(): boolean {
    return this._ligado;
  }
  get bpm(): number {
    return this._bpm;
  }
  get compasso(): number {
    return this._compasso;
  }

  /** Posição da bolinha (0 a 1) no instante visível, ou null se não está tocando. */
  progresso(): number | null {
    const agora = this.instanteVisivel();
    return agora === null ? null : progressoNoCompasso(this.fila, agora, this._bpm, this._compasso);
  }

  /** Posição do pêndulo (0 esquerda, 1 direita) no instante visível, ou null se não está tocando. */
  posicaoPendulo(): number | null {
    const agora = this.instanteVisivel();
    return agora === null ? null : posicaoDoPendulo(this.fila, agora, this._bpm);
  }

  /** O lado do clique mais recente (0 esquerda, 1 direita), ou null se não está tocando. */
  ladoAceso(): 0 | 1 | null {
    const agora = this.instanteVisivel();
    return agora === null ? null : ladoDoClique(this.fila, agora);
  }

  /** O tempo (0 = forte) aceso agora, ou null se não está tocando. */
  tempoAcesoAgora(): number | null {
    const agora = this.instanteVisivel();
    return agora === null ? null : tempoAceso(this.fila, agora);
  }

  /** O relógio de áudio menos a latência de saída, ou null se não está tocando. */
  private instanteVisivel(): number | null {
    const ctx = this.ctx;
    if (!ctx || !this._ligado) return null;
    return ctx.currentTime - atrasoDeSaida(ctx);
  }
}
