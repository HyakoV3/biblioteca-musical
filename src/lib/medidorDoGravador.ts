// O medidor de nível do gravador: um `AudioContext` só para escutar o microfone (não toca nada), com o analisador e o buffer de amostras.

import { nivelDeRms, rmsDeAmostras } from "./nivelDeSom";

export class MedidorDoGravador {
  contexto: AudioContext | null = null;
  private analisador: AnalyserNode | null = null;
  private amostras: Float32Array<ArrayBuffer> | null = null;

  /**
   * O medidor está funcionando (há analisador e o contexto de áudio está rodando). Sem ele, `nivel()` devolve sempre 0, e quem usa NÃO deve tirar
   * disso a conclusão de que "não há som": o aviso de "sem som" só vale com o medidor ativo.
   */
  get ativo(): boolean {
    return this.analisador !== null && this.contexto?.state === "running";
  }

  /** O nível do microfone agora, de 0 a 1 (0 se o medidor não está disponível). */
  nivel(): number {
    if (!this.analisador || !this.amostras) return 0;
    try {
      this.analisador.getFloatTimeDomainData(this.amostras);
      return nivelDeRms(rmsDeAmostras(this.amostras));
    } catch {
      return 0;
    }
  }

  abrir(taxa?: number): void {
    try {
      const g = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Contexto = g.AudioContext ?? g.webkitAudioContext; // WebViews e Safari antigos só têm o nome com prefixo
      if (!Contexto) return;
      this.contexto = taxa ? new Contexto({ sampleRate: taxa }) : new Contexto(); // os filtros neurais pedem 48 kHz
      void this.contexto.resume().catch(() => {});
    } catch {
      this.contexto = null; // sem medidor, a gravação segue igual
    }
  }

  ligarNoFluxo(fluxo: MediaStream): void {
    if (!this.contexto) return;
    try {
      // Só escuta: a fonte NÃO vai para a saída (senão o microfone tocaria no alto-falante).
      this.ligarEm(this.contexto.createMediaStreamSource(fluxo));
    } catch {
      this.esquecerAnalisador();
    }
  }

  /** O medidor lê a saída de `origem` (o microfone, ou o filtro neural: assim a barra mostra o que vai ser gravado). Não vai para a saída. */
  ligarEm(origem: AudioNode): void {
    if (!this.contexto) return;
    try {
      this.analisador = this.contexto.createAnalyser();
      this.analisador.fftSize = 1024;
      this.amostras = new Float32Array(new ArrayBuffer(this.analisador.fftSize * 4));
      origem.connect(this.analisador);
    } catch {
      this.esquecerAnalisador();
    }
  }

  /** Esquece o analisador e fecha o contexto. */
  fechar(): void {
    this.esquecerAnalisador();
    if (this.contexto) this.contexto.onstatechange = null;
    void this.contexto?.close().catch(() => {});
    this.contexto = null;
  }

  private esquecerAnalisador(): void {
    this.analisador = null;
    this.amostras = null;
  }
}
