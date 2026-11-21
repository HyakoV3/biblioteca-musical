// O estado do metrônomo (I-20), UM para o app todo. Fica fora do componente porque o clique NÃO para ao sair da aba nem ao abrir um hino (só quando a pessoa manda, quando o
// sistema tira o áudio ou quando um hino começa a tocar): a tela inicial é desmontada ao abrir um hino e o clique tem de seguir.
import { Metronomo } from "./metronomo";
import { adicionarRecente, lerMetronomo, salvarMetronomo, type Recente } from "./metronomoPrefs";

class EstadoMetronomo {
  private readonly nucleo = new Metronomo();
  bpm = $state(60);
  compasso = $state(4);
  ligado = $state(false);
  recentes = $state<Recente[]>([]);
  /** O áudio não pôde iniciar neste aparelho (indisponível ou bloqueado). */
  erroAudio = $state(false);
  /** O sistema tirou o áudio (ligação, outro app com o foco) e o metrônomo parou sozinho: a tela avisa. */
  interrompido = $state(false);
  /** Numera os pedidos: um `iniciar()` que falha só apaga o estado se nenhum pedido mais novo (nem uma parada) veio depois. */
  private tentativa = 0;
  private carregado = false;

  constructor() {
    this.nucleo.aoMudar = () => {
      this.ligado = this.nucleo.ligado;
    };
    this.nucleo.aoInterromper = () => {
      this.interrompido = true;
      this.ligado = false;
    };
  }

  /** Lê o que ficou guardado (só no navegador, uma vez). */
  carregar(): void {
    if (this.carregado || typeof localStorage === "undefined") return;
    this.carregado = true;
    const p = lerMetronomo();
    this.bpm = p.bpm;
    this.compasso = p.compasso;
    this.recentes = p.recentes;
    this.nucleo.definirBpm(p.bpm);
    this.nucleo.definirCompasso(p.compasso);
  }

  private guardar(): void {
    salvarMetronomo({ bpm: this.bpm, compasso: this.compasso, recentes: this.recentes });
  }

  mudarBpm(bpm: number): void {
    this.nucleo.definirBpm(bpm);
    this.bpm = this.nucleo.bpm;
    this.guardar();
  }

  mudarCompasso(compasso: number): void {
    this.nucleo.definirCompasso(compasso);
    this.compasso = this.nucleo.compasso;
    this.guardar();
  }

  /** Usa um item da lista: troca na hora o andamento e o compasso (ligado, segue tocando no novo). */
  usar(r: Recente): void {
    this.mudarCompasso(r.compasso);
    this.mudarBpm(r.bpm);
    this.recentes = adicionarRecente(this.recentes, { bpm: this.bpm, compasso: this.compasso });
    this.guardar();
  }

  /** Liga. Chamar a partir de um toque. Entra na lista dos últimos usados. */
  async iniciar(): Promise<void> {
    const minha = ++this.tentativa;
    this.erroAudio = false;
    this.interrompido = false;
    this.recentes = adicionarRecente(this.recentes, { bpm: this.bpm, compasso: this.compasso });
    this.guardar();
    try {
      await this.nucleo.iniciar();
    } catch (e) {
      if (minha === this.tentativa) this.erroAudio = true;
      console.warn("metronomo: o áudio não pôde iniciar", e);
    }
    this.ligado = this.nucleo.ligado;
  }

  parar(): void {
    this.tentativa++;
    this.nucleo.parar();
    this.ligado = false;
  }

  /** Para e devolve o áudio ao aparelho. */
  fechar(): void {
    this.tentativa++;
    this.nucleo.fechar();
    this.ligado = false;
  }

  progresso(): number | null {
    return this.nucleo.progresso();
  }

  tempoAceso(): number | null {
    return this.nucleo.tempoAcesoAgora();
  }
}

export const metronomo = new EstadoMetronomo();
