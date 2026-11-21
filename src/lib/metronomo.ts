// O metrônomo (I-20): um clique regular, com o 1º tempo do compasso forte e os demais fracos. Duas partes:
//  - funções PURAS (`agendar`, `progressoNoCompasso`, `tempoAceso`): dado o andamento, o compasso e o instante do relógio de áudio, dizem quais cliques agendar e
//    onde está a bolinha. Não tocam em áudio nem em temporizador, então são testadas com um relógio falso;
//  - a classe `Metronomo`, a casca fina com o `AudioContext`.
// O padrão é o de "A Tale of Two Clocks" (Chris Wilson): um temporizador grosso só OLHA ADIANTE e agenda os cliques no relógio de áudio (`start(tempo)`); o relógio
// de áudio é preciso, o JavaScript só precisa acordar a tempo, não na hora. O temporizador nunca soa o clique.

export const BPM_MIN = 30;
export const BPM_MAX = 240;
export const BPM_PADRAO = 60;
/** Tempos por compasso que a tela oferece. */
export const COMPASSOS = [2, 3, 4, 6] as const;
export const COMPASSO_PADRAO = 4;

/** Quanto, depois de o áudio acordar, o 1º clique espera (s): a saída ainda está começando, e no Bluetooth o primeiro som costuma se perder. */
export const ATRASO_INICIAL = 0.1;
/** De quanto em quanto o temporizador acorda para olhar adiante (ms). */
export const INTERVALO_MS = 25;
/** Quanto à frente se agenda com o app à vista (s) e escondido (s): escondido o navegador freia os temporizadores (a ~1 por segundo), então a janela é maior. */
export const JANELA = 0.1;
export const JANELA_ESCONDIDA = 2;

export function limitarBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return BPM_PADRAO;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function compassoValido(n: unknown): n is (typeof COMPASSOS)[number] {
  return typeof n === "number" && (COMPASSOS as readonly number[]).includes(n);
}

export type Clique = { tempo: number; indice: number };
/** `ultimo`: instante (relógio de áudio) do último clique agendado, ou null se ainda não há nenhum. `indice`: o tempo (0 = o forte) do PRÓXIMO clique. */
export type EstadoAgenda = { ultimo: number | null; indice: number };

/** Teto de cliques agendados numa chamada (a 240 bpm, 64 cliques são 16 s: muito além da maior janela). */
const MAX_CLIQUES_POR_CHAMADA = 64;

export function novoEstado(): EstadoAgenda {
  return { ultimo: null, indice: 0 };
}

/**
 * Agenda os cliques que caem entre `agora` e `agora + janela`. O instante do próximo clique é calculado SÓ AQUI, a partir do último e do andamento de agora: assim uma troca de
 * andamento vale a partir do primeiro clique ainda não agendado (o que já está na janela soa como estava). Se o temporizador acordou tarde e o próximo clique já ficou para trás,
 * pula para o próximo ponto da grade, mantendo a fase (o tempo certo do compasso), em vez de soar todos os perdidos de uma vez.
 */
export function agendar(
  estado: EstadoAgenda,
  p: { bpm: number; compasso: number; agora: number; janela: number; atrasoInicial?: number },
): { cliques: Clique[]; estado: EstadoAgenda } {
  const cliques: Clique[] = [];
  const { compasso, agora, janela } = p;
  // A função é pública: valida tudo o que recebe, para uma entrada ruim não gerar laço infinito, memória sem fim nem NaN que trava o metrônomo em silêncio.
  if (!Number.isFinite(p.bpm) || p.bpm <= 0 || !Number.isInteger(compasso) || compasso < 1 || !Number.isFinite(agora) || !Number.isFinite(janela) || janela < 0) {
    return { cliques, estado };
  }
  const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, p.bpm));
  const periodo = 60 / bpm;
  const atraso = Number.isFinite(p.atrasoInicial) && (p.atrasoInicial as number) >= 0 ? (p.atrasoInicial as number) : ATRASO_INICIAL;
  let ultimo = estado.ultimo !== null && Number.isFinite(estado.ultimo) ? estado.ultimo : null;
  let indice = Number.isInteger(estado.indice) ? ((estado.indice % compasso) + compasso) % compasso : 0;
  let proximo = ultimo === null ? agora + atraso : ultimo + periodo;
  // O 1º clique (ultimo nulo) é sempre agendado, mesmo que o atraso inicial caia fora da janela: senão o começo dependeria de uma borda de comparação.
  while ((proximo < agora + janela || ultimo === null) && cliques.length < MAX_CLIQUES_POR_CHAMADA) {
    if (proximo < agora) {
      // atrasado: pula as batidas perdidas e segue na grade, na fase certa
      const n = Math.ceil((agora - proximo) / periodo);
      proximo += n * periodo;
      indice = (indice + n) % compasso;
      continue;
    }
    cliques.push({ tempo: proximo, indice });
    ultimo = proximo;
    indice = (indice + 1) % compasso;
    proximo = ultimo + periodo;
  }
  return { cliques, estado: { ultimo, indice } };
}

/**
 * Onde está a bolinha na trilha do compasso, de 0 a 1 (0 = o início do 1º tempo; chega a 1 no fim do último, que é o 1º tempo seguinte). `fila` são os cliques já agendados e
 * `agora`, o instante visível (o relógio de áudio menos a latência de saída). Antes do primeiro clique soar, devolve null.
 */
export function progressoNoCompasso(fila: readonly Clique[], agora: number, bpm: number, compasso: number): number | null {
  const c = cliqueAtual(fila, agora);
  if (!c || !(bpm > 0) || !(compasso >= 1)) return null;
  // O espaçamento é o até o PRÓXIMO clique da fila, quando há: logo depois de uma troca de andamento o clique em curso ainda tem o espaçamento antigo.
  const prox = fila.find((x) => x.tempo > c.tempo);
  const periodo = prox ? prox.tempo - c.tempo : 60 / bpm;
  const decorrido = Math.min(Math.max((agora - c.tempo) / periodo, 0), 1);
  return (c.indice + decorrido) / compasso;
}

/** O tempo (0 = o forte) cujo clique soou por último até `agora`, ou null antes do primeiro. */
export function tempoAceso(fila: readonly Clique[], agora: number): number | null {
  return cliqueAtual(fila, agora)?.indice ?? null;
}

function cliqueAtual(fila: readonly Clique[], agora: number): Clique | null {
  let achado: Clique | null = null;
  for (const c of fila) {
    if (c.tempo <= agora && (achado === null || c.tempo >= achado.tempo)) achado = c;
  }
  return achado;
}

/** Timbre do clique: o forte é mais agudo e mais alto (a diferença se confere pelo `hz` no teste, e se ouve). */
export const CLIQUE_FORTE = { hz: 1600, ganho: 0.7 };
export const CLIQUE_FRACO = { hz: 1000, ganho: 0.45 };
const ATAQUE = 0.002;
const DURACAO = 0.05;

/** Quanto o som demora a sair do aparelho depois de agendado (s), para a bolinha não adiantar o clique (fone Bluetooth: 100 a 300 ms). */
export function atrasoDeSaida(ctx: Pick<AudioContext, "state" | "outputLatency">): number {
  const l = ctx.outputLatency;
  return ctx.state === "running" && Number.isFinite(l) ? Math.max(0, l) : 0;
}

type Agendado = { osc: OscillatorNode; ganho: GainNode; tempo: number };

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
export class Metronomo {
  private ctx: AudioContext | null = null;
  private estado = novoEstado();
  private fila: Clique[] = [];
  private agendados: Agendado[] = [];
  private temporizador: ReturnType<typeof setInterval> | null = null;
  /** Muda a cada `iniciar()`, `parar()` e `fechar()`: um `iniciar()` que ainda esperava o áudio e vê o número mudado já não vale. */
  private geracao = 0;
  private _bpm = BPM_PADRAO;
  private _compasso: number = COMPASSO_PADRAO;
  private _ligado = false;

  /** Chamado quando o estado muda (ligou, desligou, trocou o compasso): a tela se atualiza. */
  aoMudar: (() => void) | null = null;
  /** Chamado quando o sistema tirou o áudio (ligação, outro app com o foco) e o metrônomo parou sozinho: a tela avisa. */
  aoInterromper: (() => void) | null = null;

  constructor(private readonly opcoes: OpcoesMetronomo = {}) {}

  get ligado(): boolean {
    return this._ligado;
  }
  get bpm(): number {
    return this._bpm;
  }
  get compasso(): number {
    return this._compasso;
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
    if (!this.ctx || this.ctx.state === "closed") this.ctx = (this.opcoes.contexto ?? (() => new AudioContext()))();
    const ctx = this.ctx;
    await ctx.resume();
    // Enquanto o áudio iniciava, a pessoa pode ter parado, saído da aba (fechar) ou iniciado de novo: este já não vale.
    if (minha !== this.geracao || this.ctx !== ctx) return;
    // Alguns navegadores (WebKit/iOS) resolvem `resume()` com o contexto ainda suspenso ou interrompido: o relógio não anda e nenhum `statechange` vem. Não liga e avisa.
    if (ctx.state !== "running") {
      this.aoInterromper?.();
      return;
    }
    this.desligarTemporizador();
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
    this.temporizador = setInterval(() => this.olharAdiante(), INTERVALO_MS);
    // Ao esconder a página o navegador freia os temporizadores: agenda já a janela grande, antes do próximo (atrasado) tick.
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.aoVisibilidade);
    this.aoMudar?.();
  }

  /** Para na hora: os cliques agendados que ainda não soaram são cancelados (senão soariam ao reiniciar). O contexto fica (como o do afinador). */
  parar(): void {
    this.geracao++;
    this.desligarTemporizador();
    this.cancelarAgendados();
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

  /** Posição da bolinha (0 a 1) no instante visível, ou null se não está tocando. */
  progresso(): number | null {
    const ctx = this.ctx;
    if (!ctx || !this._ligado) return null;
    return progressoNoCompasso(this.fila, ctx.currentTime - atrasoDeSaida(ctx), this._bpm, this._compasso);
  }

  /** O tempo (0 = forte) aceso agora, ou null se não está tocando. */
  tempoAcesoAgora(): number | null {
    const ctx = this.ctx;
    if (!ctx || !this._ligado) return null;
    return tempoAceso(this.fila, ctx.currentTime - atrasoDeSaida(ctx));
  }

  private recomecar(): void {
    this.cancelarAgendados();
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
      this.soar(ctx, c);
      this.fila.push(c);
    }
    // Poda o que já soou e não serve mais: só a fila das últimas batidas importa para a bolinha.
    const limite = ctx.currentTime - 2;
    this.agendados = this.agendados.filter((a) => a.tempo > limite);
    if (this.fila.length > 16) this.fila = this.fila.slice(-16);
  }

  private soar(ctx: AudioContext, c: Clique): void {
    const perfil = c.indice === 0 ? CLIQUE_FORTE : CLIQUE_FRACO;
    const osc = ctx.createOscillator();
    osc.frequency.value = perfil.hz;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0, c.tempo);
    ganho.gain.linearRampToValueAtTime(perfil.ganho, c.tempo + ATAQUE);
    ganho.gain.exponentialRampToValueAtTime(0.0001, c.tempo + DURACAO);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(c.tempo);
    osc.stop(c.tempo + DURACAO + 0.01);
    this.agendados.push({ osc, ganho, tempo: c.tempo });
  }

  private cancelarAgendados(): void {
    const agora = this.ctx?.currentTime ?? 0;
    for (const a of this.agendados) {
      if (a.tempo <= agora) continue; // já soou (ou está soando): deixa terminar
      // Desconecta primeiro (isso garante o silêncio) e isola o `stop`: ele já foi chamado em `soar()` e, em WebKit antigo, uma segunda chamada lança.
      try {
        a.ganho.disconnect();
        a.osc.disconnect();
      } catch {
        // já desconectado
      }
      try {
        a.osc.stop(0); // parar antes de começar: o clique agendado nunca soa
      } catch {
        // já tinha parado
      }
    }
    this.agendados = [];
  }

  private readonly aoVisibilidade = () => this.olharAdiante();

  private desligarTemporizador(): void {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.aoVisibilidade);
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
