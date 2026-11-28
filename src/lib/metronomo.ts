// O metrônomo (I-20): um clique regular, com o 1º tempo do compasso forte e os demais fracos. Partes:
//  - `metronomoAgenda.ts`: função PURA `agendar` (quais cliques agendar) e os limites;
//  - `metronomoPosicao.ts`: funções PURAS da bolinha (progresso, pêndulo, lado, tempo aceso);
//  - `metronomoClique.ts`: o timbre e o som de cada clique; `metronomoVigia.ts`: o temporizador que olha adiante; `metronomoLeitura.ts`: o lado de leitura da classe;
//  - aqui, a classe `Metronomo`, a casca fina com o `AudioContext`.
// O padrão é o de "A Tale of Two Clocks" (Chris Wilson): um temporizador grosso só OLHA ADIANTE e agenda os cliques no relógio de áudio (`start(tempo)`); o relógio
// de áudio é preciso, o JavaScript só precisa acordar a tempo, não na hora. O temporizador nunca soa o clique.

import { JANELA, JANELA_ESCONDIDA, agendar, compassoValido, limitarBpm, novoEstado } from "./metronomoAgenda";
import { cancelarAgendados, soarClique, type Agendado } from "./metronomoClique";
import { LeituraDoMetronomo } from "./metronomoLeitura";
import { Vigia } from "./metronomoVigia";
import { criarContexto } from "./saidaAudio";

export * from "./metronomoAgenda";
export { CLIQUE_FORTE, CLIQUE_FRACO, CLIQUE_MEDIO, atrasoDeSaida, ehComposto, perfilDoClique } from "./metronomoClique";
export * from "./metronomoPosicao";

export type OpcoesMetronomo = {
  /** Cria o contexto de áudio (um falso nos testes). */
  contexto?: () => AudioContext;
  /** A página está escondida? Escondida, a janela de agendamento é maior. */
  escondida?: () => boolean;
};

/**
 * A casca fina do metrônomo, com o seu PRÓPRIO `AudioContext` criado no toque da pessoa (o do sintetizador é privado e a pausa do hino é `suspend()`, que calaria o clique; o
 * `TomSustentado` do afinador tomou a mesma decisão). Não há controle de volume: quem ajusta é o volume de mídia do celular.
 */
export class Metronomo extends LeituraDoMetronomo {
  private estado = novoEstado();
  private agendados: Agendado[] = [];
  private readonly vigia = new Vigia(() => this.olharAdiante());
  /** Muda a cada `iniciar()`, `parar()` e `fechar()`: um `iniciar()` que ainda esperava o áudio e vê o número mudado já não vale. */
  private geracao = 0;

  /** Chamado quando o estado muda (ligou, desligou, trocou o compasso): a tela se atualiza. */
  aoMudar: (() => void) | null = null;
  /** Chamado quando o sistema tirou o áudio (ligação, outro app com o foco) e o metrônomo parou sozinho: a tela avisa. */
  aoInterromper: (() => void) | null = null;

  constructor(private readonly opcoes: OpcoesMetronomo = {}) {
    super();
  }

  /** Muda o andamento (limitado a 30..240). Vale a partir do primeiro clique ainda não agendado, sem parar nem estalar. */
  definirBpm(bpm: number): void {
    const novo = limitarBpm(bpm);
    if (novo === this._bpm) return;
    this._bpm = novo;
    this.aoMudar?.();
  }

  /** Muda o compasso. Ligado, recomeça a contagem no 1º tempo: os cliques ainda não soados (com o acento antigo) são cancelados. */
  definirCompasso(compasso: number): void {
    if (!compassoValido(compasso) || compasso === this._compasso) return;
    this._compasso = compasso;
    if (this._ligado) this.recomecar();
    this.aoMudar?.();
  }

  /** Liga o metrônomo. Chamar a partir de um toque da pessoa: o áudio só inicia depois de um gesto. */
  async iniciar(): Promise<void> {
    const minha = ++this.geracao;
    if (!this.ctx || this.ctx.state === "closed") this.ctx = (this.opcoes.contexto ?? criarContexto)();
    const ctx = this.ctx;
    await ctx.resume();
    // Enquanto o áudio iniciava, a pessoa pode ter parado, saído da aba (fechar) ou iniciado de novo: este já não vale.
    if (minha !== this.geracao || this.ctx !== ctx) return;
    // Alguns navegadores (WebKit/iOS) resolvem `resume()` com o contexto ainda suspenso ou interrompido: o relógio não anda e nenhum `statechange` vem. Não liga e avisa.
    if (ctx.state !== "running") {
      this.aoInterromper?.();
      return;
    }
    this.ligar(ctx);
  }

  /** Para na hora: os cliques agendados que ainda não soaram são cancelados (senão soariam ao reiniciar). O contexto fica (como o do afinador). */
  parar(): void {
    this.geracao++;
    this.vigia.desligar();
    this.cancelar();
    this.fila = [];
    const estava = this._ligado;
    this._ligado = false;
    if (estava) this.aoMudar?.();
  }

  /** Para e devolve o áudio ao aparelho (fecha o contexto logo depois). */
  fechar(): void {
    this.parar();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      ctx.onstatechange = null;
      if (ctx.state !== "closed") setTimeout(() => void ctx.close().catch(() => {}), 150);
    }
  }

  private ligar(ctx: AudioContext): void {
    this.vigia.desligar();
    this.recomecar();
    this._ligado = true;
    ctx.onstatechange = () => {
      // O sistema tirou o áudio com o metrônomo ligado: para e avisa, sem tentar `resume()` sozinho (sem gesto, falha).
      if (ctx.state !== "running" && this._ligado && this.ctx === ctx) {
        this.parar();
        this.aoInterromper?.();
      }
    };
    this.olharAdiante();
    // Ao esconder a página o navegador freia os temporizadores: o vigia agenda já a janela grande, antes do próximo (atrasado) tick.
    this.vigia.ligar();
    this.aoMudar?.();
  }

  private recomecar(): void {
    this.cancelar();
    this.fila = [];
    this.estado = novoEstado();
  }

  private olharAdiante(): void {
    const ctx = this.ctx;
    if (!ctx || !this._ligado) return;
    const escondida = this.opcoes.escondida?.() ?? (typeof document !== "undefined" && document.hidden);
    const { cliques, estado } = agendar(this.estado, {
      bpm: this._bpm,
      compasso: this._compasso,
      agora: ctx.currentTime,
      janela: escondida ? JANELA_ESCONDIDA : JANELA,
    });
    this.estado = estado;
    for (const c of cliques) {
      this.agendados.push(soarClique(ctx, c, this._compasso));
      this.fila.push(c);
    }
    this.podar(ctx.currentTime);
  }

  /** Poda o que já soou e não serve mais: só a fila das últimas batidas importa para a bolinha. */
  private podar(agora: number): void {
    const limite = agora - 2;
    this.agendados = this.agendados.filter((a) => a.tempo > limite);
    if (this.fila.length > 16) this.fila = this.fila.slice(-16);
  }

  private cancelar(): void {
    cancelarAgendados(this.agendados, this.ctx?.currentTime ?? 0);
    this.agendados = [];
  }
}
