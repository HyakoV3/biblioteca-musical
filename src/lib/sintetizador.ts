// Sintetizador simples com Web Audio: toca notas (MIDI) de várias vozes.
// Não usa gravações: tudo é gerado a partir dos eventos de nota do pacote.
// Pausar suspende o relógio do AudioContext: as notas já agendadas retomam do ponto certo.
// Para mudar instrumento, andamento ou tom no meio do hino, `tocar` reagenda tudo a partir de uma posição em batidas.
import { chaveAtual, criarContexto } from "./saidaAudio";
import { INSTRUMENTOS, PADRAO, type SinteticoId } from "./instrumentos";
import { ehRealista, sinteticoEquivalente } from "./realista";
import { Gravados, type InstrumentoGravado } from "./gravados";
import { agendarGravada, agendarSintetizada, notasAPartirDe, type Cena, type Nota, type Opcoes, type Voz } from "./agendamento";

export { agendarNota, frequencia } from "./sintese-nota";
export { notasAPartirDe, type Nota, type Opcoes, type Voz } from "./agendamento";

/** Como `tocar` deve começar. */
export type Partida = {
  /** Posição, em batidas, de onde tocar (0 = do começo). */
  aPartirDe?: number;
  /** O relógio está suspenso (pausa): agenda sem retomar; quem chamou retoma depois com `continuar()`. */
  pausado?: boolean;
};

/** Antecedência do início, em segundos, para dar tempo de agendar todas as notas. */
const ATRASO_INICIAL = 0.1;

/** O sintetizado que toca o instrumento pedido: ele mesmo; se é um gravado (que falhou ao carregar), o equivalente dele; sem par, o padrão. */
export function sinteticoParaTocar(pedido: string | undefined): SinteticoId {
  if (pedido && pedido in INSTRUMENTOS) return pedido as SinteticoId;
  if (pedido && ehRealista(pedido)) return sinteticoEquivalente(pedido) ?? PADRAO;
  return PADRAO;
}


/** Executa `fn` ignorando o erro (o que se quer parar já estava parado, ou não existe). */
function tentar(fn: () => void): void {
  try {
    fn();
  } catch {
    /* já parado, ou sem agendador */
  }
}

export class Sintetizador {
  private ctx: AudioContext | null = null;
  /** A rota e o modo de áudio com que `ctx` nasceu: se a pessoa trocar de saída ou de modo, o contexto é refeito antes do próximo hino. */
  private chaveDoCtx = "";
  private mestre: GainNode | null = null;
  private ganhos: GainNode[] = [];
  private fontes: AudioScheduledSourceNode[] = [];
  private ondas = new Map<string, PeriodicWave>();
  /** Instrumentos gravados já carregados, um por (instrumento, voz): as amostras demoram a decodificar e se reaproveitam. */
  private reais = new Gravados();
  /** Os gravados que estão soando no agendamento atual (para parar). */
  private reaisAtivos: InstrumentoGravado[] = [];
  private inicio = 0;
  /** Segundos já "tocados" antes do início do agendamento atual (quando tocar começou no meio do hino). */
  private base = 0;
  /** O atraso de saída que valia no instante da pausa (ver `audivel`). */
  private latenciaNaPausa = 0;

  /** Fecha o contexto de uma saída que a pessoa deixou: as ondas e os instrumentos gravados nasceram nele e não servem a outro. */
  private descartarContexto(): void {
    const velho = this.ctx;
    this.ctx = null;
    this.ondas.clear();
    this.reais.limpar();
    this.reaisAtivos = [];
    if (velho && velho.state !== "closed") void velho.close().catch(() => {});
  }

  /** O contexto de áudio pronto para agendar: refeito se a saída mudou, retomado (ou, com a partida pausada, suspenso). */
  private async contextoPronto(partida: Partida): Promise<AudioContext> {
    const chave = chaveAtual();
    if (this.ctx && chave !== this.chaveDoCtx) this.descartarContexto();
    if (!this.ctx) {
      this.ctx = criarContexto();
      this.chaveDoCtx = chave;
    }
    // Em iOS/WebView o áudio só inicia após um gesto do usuário (clique em "Tocar").
    if (!partida.pausado) await this.ctx.resume();
    const ctx = this.ctx;
    // Pedido de um ponto COM o hino pausado (arrastar a barra depois de trocar de saída): o contexto novo nasce rodando, e a tela diz "pausado".
    if (partida.pausado && ctx.state === "running") await ctx.suspend();
    return ctx;
  }

  /** Compressor no fim da cadeia (várias vozes somadas não estouram o volume), o volume mestre e um ganho por voz. */
  private montarCadeia(ctx: AudioContext, vozes: Voz[], volumes: number[]): GainNode[] {
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    const mestre = ctx.createGain();
    mestre.gain.value = 0.9;
    mestre.connect(compressor);
    this.mestre = mestre;
    // Todas as vozes são agendadas; silenciar é só baixar o volume da voz (vale ao vivo).
    // `ganhos` fica em referência LOCAL: `parar()` (que zera `this.ganhos`) pode rodar durante o carregamento dos sons gravados.
    const ganhos = vozes.map((_, i) => {
      const g = ctx.createGain();
      g.gain.value = volumes[i] ?? 1;
      g.connect(mestre);
      return g;
    });
    this.ganhos = ganhos;
    return ganhos;
  }

  /** Instrumentos gravados: carrega antes de marcar o início (a primeira vez demora; depois ficam guardados). `null` na voz que toca sintetizada. */
  private carregarGravados(ctx: AudioContext, vozes: Voz[], opcoes: Opcoes, ganhos: GainNode[]): Promise<(InstrumentoGravado | null)[]> {
    return Promise.all(
      vozes.map((_, i) => {
        const pedido = opcoes.instrumentos[i];
        // Se o som gravado não carregar (pacote removido, sem arquivo), a voz toca na síntese padrão.
        return pedido && ehRealista(pedido) ? this.reais.carregar(ctx, pedido, i, ganhos[i]).catch(() => null) : null;
      }),
    );
  }

  /**
   * Agenda e começa a tocar. Devolve a duração total do hino em segundos, no andamento pedido (contando também o
   * que ficou para trás quando `aPartirDe` não é 0, para o tempo decorrido e a duração continuarem na mesma régua).
   */
  async tocar(vozes: Voz[], opcoes: Opcoes, partida: Partida = {}): Promise<number> {
    this.parar();
    const ctx = await this.contextoPronto(partida);
    const ganhos = this.montarCadeia(ctx, vozes, opcoes.volumes);

    const seg = 60 / Math.max(opcoes.andamento, 1); // segundos por batida
    const aPartirDe = Math.max(0, partida.aPartirDe ?? 0);
    this.base = aPartirDe * seg;
    const reais = await this.carregarGravados(ctx, vozes, opcoes, ganhos);
    this.inicio = ctx.currentTime + ATRASO_INICIAL;
    const cena: Cena = { ctx, opcoes, aPartirDe, seg, inicio: this.inicio, ondas: this.ondas };

    let fim = 0;
    vozes.forEach((voz, i) => {
      const real = reais[i];
      if (real) {
        fim = Math.max(fim, agendarGravada(cena, voz, real));
        this.reaisAtivos.push(real);
      } else {
        const sintetizada = agendarSintetizada(cena, voz, sinteticoParaTocar(opcoes.instrumentos[i]), ganhos[i]);
        this.fontes.push(...sintetizada.fontes);
        fim = Math.max(fim, sintetizada.fim);
      }
    });
    return this.base + fim;
  }

  /** Segundos tocados desde o início do hino (congela durante a pausa). */
  decorrido(): number {
    return this.ctx ? this.base + Math.max(0, this.ctx.currentTime - this.inicio) : 0;
  }

  /**
   * Como `decorrido`, mas descontando o atraso da saída de áudio do aparelho: o que se OUVE agora, e não o que já foi
   * entregue ao hardware. Serve para o karaokê não acender a sílaba antes de ela soar. Na pausa, vale o `decorrido`.
   */
  audivel(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const atual = Number.isFinite(ctx.outputLatency) ? Math.max(0, ctx.outputLatency) : 0;
    // Na pausa o desconto fica CONGELADO no valor de quando pausou (o relógio não anda, e zerá-lo faria o tempo e a parte destacada saltarem).
    const atraso = ctx.state === "running" ? atual : this.latenciaNaPausa;
    return Math.max(0, this.decorrido() - atraso);
  }

  async pausar() {
    const ctx = this.ctx;
    if (ctx && ctx.state === "running" && Number.isFinite(ctx.outputLatency)) this.latenciaNaPausa = Math.max(0, ctx.outputLatency);
    await ctx?.suspend();
  }

  async continuar() {
    await this.ctx?.resume();
    this.latenciaNaPausa = 0;
  }

  /** Ajusta o volume de uma voz enquanto toca (0 silencia). */
  volume(voz: number, valor: number) {
    const g = this.ganhos[voz];
    if (g && this.ctx) g.gain.setTargetAtTime(valor, this.ctx.currentTime, 0.015);
  }

  parar() {
    for (const o of this.fontes) tentar(() => o.stop());
    this.fontes = [];
    for (const inst of this.reaisAtivos) {
      // `stop()` só cala as notas que já estão soando. As notas futuras ficam na fila do agendador do smplr e
      // seguiriam disparando no andamento antigo por cima do novo: é preciso esvaziar a fila também.
      tentar(() => inst.scheduler.stop());
      tentar(() => inst.stop());
    }
    this.reaisAtivos = [];
    this.ganhos = [];
    this.mestre?.disconnect();
    this.mestre = null;
    this.latenciaNaPausa = 0;
  }
}
