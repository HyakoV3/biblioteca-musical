// Gravador de áudio (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho: a gravação fica na memória do app
// até a pessoa descartá-la ou sair. A parte pura (escolha do formato, textos de tempo e tamanho, nível de som) mora em `gravadorTexto.ts` e `nivelDeSom.ts`
// (reexportadas aqui) e se testa no Vitest; o resto liga a API do navegador (`getUserMedia` e `MediaRecorder`), que no WebView do Android depende de o
// aplicativo ter a permissão de microfone.

import { FILTRO_PADRAO, TAXA_NEURAL, ehNeural, type FiltroDeRuido } from "./filtroDeRuido";
import { ligarFiltroNeural, desligarNos, type NosDoFiltro } from "./filtroNeuralNoGravador";
import { criarRecorder, guardarPedaco, ligarOuvintes, pararEEntregar, pararSemAvisar, rastro } from "./recorderDoGravador";
import { MedidorDoGravador } from "./medidorDoGravador";

export * from "./gravadorTexto";
export * from "./nivelDeSom";
export * from "./corrigirDuracao";
export { BITS_POR_SEGUNDO, LIMITE_PARA_PARAR_MS, rastro } from "./recorderDoGravador";

export type Gravacao = { url: string; blob: Blob; tipo: string; bytes: number; segundos: number };

/**
 * Uma sessão de gravação do microfone. `iniciar` pede o microfone (a permissão é pedida aqui, a partir de um toque), `parar` entrega o arquivo e
 * `soltar` devolve o microfone ao aparelho na hora (também ao esconder o app). Sem efeitos de voz (cancelamento de eco, supressão de ruído e
 * ganho automático desligados) para o som sair como foi tocado ou cantado. Quem usa deve evitar chamadas ao mesmo tempo (a tela ignora toques
 * enquanto um pedido ou uma parada está em andamento).
 */
export class Gravador {
  private fluxo: MediaStream | null = null;
  private gravador: MediaRecorder | null = null;
  private readonly medidor = new MedidorDoGravador();
  /** O filtro neural no caminho do microfone (fonte, filtro e destino), quando há: o gravador grava a saída do destino. */
  private nos: NosDoFiltro | null = null;
  private pedacos: Blob[] = [];
  private inicio = 0;
  /** Quando a gravação terminou (por `parar` ou porque a trilha do microfone acabou); 0 enquanto grava. */
  private fim = 0;
  /** Formato em uso; conhecido depois de `iniciar`. */
  tipo = "";
  /** Avisa quem usa quando a gravação PARA SOZINHA (ligação, outro app pegou o microfone, permissão revogada, erro do gravador): ele chama `parar` para guardar o que já foi gravado. */
  aoInterromper: (() => void) | null = null;
  /** Avisa quem usa a cada pedaço que o gravador entrega (um por segundo), com o número dele (de 0): quem guarda cada pedaço a mais deixa a gravação sobreviver a uma queda do app (AND-002). */
  aoPedaco: ((indice: number, pedaco: Blob) => void) | null = null;

  get gravando(): boolean {
    return this.gravador?.state === "recording";
  }

  /**
   * `filtro` escolhe a redução de ruído desta gravação (I-29): desligada por padrão, para o som sair fiel. Devolve o filtro que de fato foi aplicado: se um filtro neural não pôde ser ligado
   * (sem AudioWorklet, sem WebAssembly, arquivo que não carrega), a gravação SEGUE sem filtro (devolve "desligado") em vez de falhar, e a tela avisa.
   */
  async iniciar(opcoes: { filtro?: FiltroDeRuido } = {}): Promise<FiltroDeRuido> {
    if (this.gravando) return "desligado";
    const filtro = opcoes.filtro ?? FILTRO_PADRAO;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new DOMException("sem gravação", "NotSupportedError");
    // O contexto do medidor nasce AGORA, no toque (o navegador só deixa o áudio iniciar depois de um gesto), e não depois da espera pela permissão.
    this.medidor.abrir(ehNeural(filtro) ? TAXA_NEURAL : undefined);
    try {
      this.fluxo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: filtro === "android", autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      this.soltar();
      throw e;
    }
    try {
      return await this.comecar(this.fluxo, filtro);
    } catch (e) {
      this.soltar();
      throw e;
    }
  }

  /** Com o microfone na mão, monta o caminho do som, cria o gravador e começa. Devolve o filtro de fato aplicado. */
  private async comecar(mic: MediaStream, filtro: FiltroDeRuido): Promise<FiltroDeRuido> {
    // O que o gravador grava: o microfone direto, ou a saída do filtro neural.
    let aGravar: MediaStream = mic;
    let aplicado: FiltroDeRuido = filtro;
    if (ehNeural(filtro)) {
      const ligado = await this.ligarFiltro(filtro, mic);
      if (this.fluxo !== mic) throw new DOMException("cancelado", "AbortError"); // `soltar` aconteceu enquanto o filtro carregava
      if (ligado) aGravar = ligado;
      else aplicado = "desligado";
    }
    if (!this.nos) this.medidor.ligarNoFluxo(mic);
    const { recorder, preferido } = criarRecorder(aGravar);
    this.gravador = recorder;
    this.tipo = recorder.mimeType || preferido || "";
    this.pedacos = [];
    this.fim = 0;
    ligarOuvintes(recorder, mic, this.nos ? this.medidor.contexto : null, (d) => guardarPedaco(this.pedacos, d, this.aoPedaco), () => this.interrompida());
    recorder.start(1000); // um pedaço por segundo: uma queda no meio ainda deixa o que já foi gravado
    this.inicio = performance.now();
    rastro(`gravando (${this.tipo || "formato do navegador"}, filtro ${aplicado})`);
    return aplicado;
  }

  /** Põe o filtro neural entre o microfone e o gravador. Devolve o fluxo filtrado, ou nulo se não deu: aí a gravação segue sem filtro. O medidor passa a ler a saída do filtro. */
  private async ligarFiltro(qual: "rnnoise" | "gtcrn", mic: MediaStream): Promise<MediaStream | null> {
    const ctx = this.medidor.contexto;
    // `soltar` durante a carga troca o fluxo ou o contexto: o filtro então não fica ligado.
    const nos = await ligarFiltroNeural(ctx, this.fluxo, qual, () => this.fluxo === mic && this.medidor.contexto === ctx);
    if (!nos) return null;
    this.nos = nos;
    this.medidor.ligarEm(nos.filtro);
    return nos.destino.stream;
  }

  /** A gravação parou sozinha (o sistema tirou o microfone, o gravador deu erro ou o contexto de áudio parou): marca o fim e avisa. */
  private interrompida(): void {
    if (this.fim === 0) this.fim = performance.now();
    this.aoInterromper?.();
  }

  /**
   * O medidor está funcionando (há analisador e o contexto de áudio está rodando). Sem ele, `nivel()` devolve sempre 0, e quem usa NÃO deve tirar
   * disso a conclusão de que "não há som": o aviso de "sem som" só vale com o medidor ativo.
   */
  get medidorAtivo(): boolean {
    return this.medidor.ativo;
  }

  /** O nível do microfone agora, de 0 a 1 (0 se o medidor não está disponível). */
  nivel(): number {
    return this.medidor.nivel();
  }

  /** Para e entrega o arquivo (ou nulo se não chegou nada). Também entrega o que foi gravado até aqui se a gravação já tinha parado sozinha. O microfone é devolvido ao aparelho. */
  parar(): Promise<Gravacao | null> {
    const g = this.gravador;
    if (!g) {
      this.soltar();
      return Promise.resolve(null);
    }
    if (g.state === "inactive") return Promise.resolve(this.entregar());
    rastro(`parando (estado ${g.state}, ${this.pedacos.length} pedaços)`);
    return new Promise((ok) => {
      pararEEntregar(
        g,
        () => {
          if (this.fim === 0) this.fim = performance.now();
        },
        () => ok(this.entregar()),
      );
    });
  }

  /** Monta o arquivo com os pedaços desta sessão, esquece os pedaços (a gravação não fica retida na memória do gravador) e devolve o microfone. */
  private entregar(): Gravacao | null {
    const tipo = this.tipo || this.gravador?.mimeType || "audio/webm";
    const segundos = ((this.fim || performance.now()) - this.inicio) / 1000;
    const blob = new Blob(this.pedacos, { type: tipo });
    this.soltar();
    rastro(`entregando ${blob.size} bytes, ${segundos.toFixed(1)} s`);
    return blob.size > 0 ? { url: URL.createObjectURL(blob), blob, tipo, bytes: blob.size, segundos } : null;
  }

  /** Devolve o microfone ao aparelho (apaga o ícone de gravação do Android), esquece o gravador e os pedaços. */
  soltar(): void {
    this.fluxo?.getTracks().forEach((t) => t.stop());
    this.fluxo = null;
    if (this.gravador) pararSemAvisar(this.gravador);
    this.gravador = null;
    this.pedacos = [];
    if (this.nos) desligarNos(this.nos.fonte, this.nos.filtro);
    this.nos = null;
    this.medidor.fechar();
  }
}
