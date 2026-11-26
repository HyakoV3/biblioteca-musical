// A gravação em curso, UMA para o app todo (ARQ-003, GRV-001). O ciclo de vida da gravação (pedir o microfone, o relógio e o medidor, parar, guardar, recuperar) mora aqui, e não no componente
// `Gravador.svelte`: a tela inicial é desmontada ao abrir um hino, e, com o serviço do Android assumindo a gravação, ela TEM de seguir (como o clique do metrônomo, que também vive fora da tela).
// O componente só mostra o estado e, quando existe, recebe o resultado em `aoTerminar` (para pôr a gravação nova na lista). Sem componente por perto, o resultado vira o aviso `perdida`.
import { biblioteca } from "./biblioteca.svelte";
import { marcarMudanca, montarContexto, type ContextoGravacao } from "./contexto";
import type { FiltroDeRuido } from "./filtroDeRuido";
import { DetectorDeSom, Gravador, motivoDoErro, nivelParaBarra, rastro, suavizarBarra, type Gravacao, type MotivoDoErro } from "./gravador";
import { LIMITE_PARA_GUARDAR_MS, LimiteEstourado, comLimite, gravacoes, type MetaGravacao } from "./gravacoes";
import { metronomo } from "./metronomo.svelte";
import { reproducao } from "./reproducao.svelte";
import { aoFalharServicoDeGravacao, aoPararGravacaoPelaNotificacao, desligarServicoDeGravacao, foneConectado, ligarServicoDeGravacao } from "./servico";

const MOTIVO_DEMORA = "o armazenamento demorou demais para guardar a gravação";

/** O que `guardarComPrazo` conta: guardada dentro do prazo, ou não (por erro, ou porque demorou; nesse caso `depois` diz, mais tarde, se a escrita terminou). */
export type ResultadoDoGuardar = { guardada: true; meta: MetaGravacao } | { guardada: false; demorou: boolean; depois: Promise<MetaGravacao> };

/**
 * O ÚNICO lugar que guarda uma gravação com prazo: espera `salvando` até `ms`. O estouro do prazo é o erro próprio `LimiteEstourado` (nada de comparar o texto da mensagem), e a escrita que
 * continua depois do prazo segue em `depois`, para quem precisar saber que a gravação, afinal, foi guardada.
 */
export async function guardarComPrazo(salvando: Promise<MetaGravacao>, ms = LIMITE_PARA_GUARDAR_MS): Promise<ResultadoDoGuardar> {
  salvando.catch(() => {}); // quem olha o resultado tardio é `depois`; sem isto, uma escrita que falha depois do prazo seria uma rejeição sem dono
  try {
    return { guardada: true, meta: await comLimite(salvando, ms, MOTIVO_DEMORA) };
  } catch (e) {
    return { guardada: false, demorou: e instanceof LimiteEstourado, depois: salvando };
  }
}

/** Como terminou uma gravação, para quem mostra a lista (`aoTerminar`). */
export type Resultado =
  | { tipo: "guardada"; meta: MetaGravacao }
  /** Nada chegou do microfone: não há o que guardar. */
  | { tipo: "vazia" }
  /** Não deu para guardar dentro do prazo (cota cheia, armazenamento mudo): a gravação fica à mão para ouvir e enviar. `depois` diz se a escrita ainda terminou. */
  | { tipo: "nao-guardada"; gravacao: Gravacao; demorou: boolean; depois: Promise<MetaGravacao> };

export type ResultadoDeIniciar = { cancelada: boolean; erro: MotivoDoErro | null; filtroFalhou: FiltroDeRuido | null };

/** O que a gravação precisa do resto do app; os testes trocam por falsos. */
export type Dependencias = {
  criarGravador: () => Gravador;
  armazenamento: Pick<typeof gravacoes, "salvar" | "abrirSessao" | "guardarPedaco" | "descartarSessao" | "recuperarSessoes">;
  lerContexto: () => ContextoGravacao | null;
  foneConectado: () => boolean;
  /** Sem fone, um som de cada vez: o hino e o metrônomo calam antes de gravar (o alto-falante entraria no microfone). */
  calarSons: () => void;
  servico: { ligar: () => boolean; desligar: () => void; aoParar: (quando: () => void) => () => void; aoFalhar: (quando: () => void) => () => void };
  agora: () => number;
  pagina: { escondida: () => boolean; aoMudar: (quando: () => void) => () => void };
};

/** O que a pessoa ouve no fone agora (metrônomo ou hino), para guardar com a gravação (I-38). Nulo sem fone ou sem nada tocando. */
function lerContextoReal(): ContextoGravacao | null {
  const atual = reproducao.atual;
  const hino = atual && reproducao.estado === "tocando" ? biblioteca.pacote?.hinario.hinos.find((h) => h.numero === atual.numero) : undefined;
  const c = hino ? reproducao.config(hino) : null;
  return montarContexto({
    fone: foneConectado(),
    metronomo: { ligado: metronomo.ligado, bpm: metronomo.bpm, compasso: metronomo.compasso },
    hino:
      atual && hino && c
        ? {
            tocando: true,
            numero: atual.numero,
            titulo: atual.titulo,
            tonalidade: hino.tonalidade,
            transposicao: c.transposicao,
            andamento: c.andamento,
            andamentoOriginal: hino.andamento,
            parte: atual.parte,
            vozes: hino.vozes.map((v, i) => ({ nome: v.nome, muda: c.mudas[i] ?? false })),
          }
        : null,
  });
}

const dependenciasReais = (): Dependencias => ({
  criarGravador: () => new Gravador(),
  armazenamento: gravacoes,
  lerContexto: lerContextoReal,
  foneConectado,
  calarSons: () => {
    reproducao.parar();
    metronomo.parar(); // o clique do alto-falante entraria na gravação
  },
  servico: { ligar: ligarServicoDeGravacao, desligar: desligarServicoDeGravacao, aoParar: aoPararGravacaoPelaNotificacao, aoFalhar: aoFalharServicoDeGravacao },
  agora: () => performance.now(),
  pagina: {
    escondida: () => typeof document !== "undefined" && document.hidden,
    aoMudar: (quando) => {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", quando);
      return () => document.removeEventListener("visibilitychange", quando);
    },
  },
});

export class GravacaoEmCurso {
  gravando = $state(false);
  /** Segundos gravados até agora (a tela só mostra; o tempo certo da gravação é o medido ao parar). */
  decorrido = $state(0);
  /** O medidor de som: nível de 0 a 1 que a barra mostra (sobe na hora e desce devagar). */
  nivel = $state(0);
  /** Já entrou som nesta gravação (avisa o leitor de tela uma vez). */
  ouviu = $state(false);
  /** Faz tempo demais sem som: o microfone pode estar tapado, mudo ou sem permissão de verdade. */
  semSom = $state(false);
  /**
   * "falhou" = a gravação não pôde ser guardada e a tela do Gravador já se foi; "incerta" = o armazenamento demorou demais e não se sabe se ela foi guardada (some se a escrita terminar).
   * Vive aqui, fora do componente, para a tela inicial mostrar o aviso quando a pessoa voltar a ela; some ao começar outra gravação.
   */
  perdida = $state<"falhou" | "incerta" | null>(null);
  /** No Android o serviço em primeiro plano (microfone) assumiu a gravação: ela segue com a tela bloqueada, em outra aba e com a tela do hino aberta. */
  protegida = false;
  /** Quem mostra a lista de gravações (a tela do Gravador, quando existe) recebe aqui o resultado de cada gravação. */
  aoTerminar: ((resultado: Resultado) => void) | null = null;

  private readonly gravador: Gravador;
  private readonly detector = new DetectorDeSom();
  private relogio: ReturnType<typeof setInterval> | null = null;
  private medidor: ReturnType<typeof setInterval> | null = null;
  /** Numera os pedidos: uma resposta tardia do microfone não vale se a pessoa já mandou parar ou saiu da aba. */
  private tentativa = 0;
  /** Um pedido de microfone ou uma parada está em andamento: os toques em "Gravar" e "Parar" são ignorados até acabar (dois pedidos juntos deixavam um microfone órfão). */
  private ocupadoAgora = false;
  /** O contexto do instante em que a gravação começou; ao parar (lido ANTES de qualquer espera), vira o contexto guardado, com a marca de que algo mudou, se mudou. */
  private contextoDoInicio: ContextoGravacao | null = null;
  /** A sessão de recuperação desta gravação (AND-002): os pedaços vão sendo guardados nela, e uma queda do app deixa o que já foi gravado. Nula se o armazenamento não abriu. */
  private sessao: Promise<string | null> | null = null;
  private ouvintes: (() => void)[] = [];
  private deps: Dependencias | null;

  constructor(deps?: Dependencias) {
    this.deps = deps ?? null;
    this.gravador = this.d.criarGravador();
    // A gravação parou sozinha (o sistema tirou o microfone, o gravador falhou): guarda o que já foi gravado, em vez de a tela seguir "gravando".
    this.gravador.aoInterromper = () => {
      if (this.gravando) void this.parar();
    };
  }

  private get d(): Dependencias {
    return (this.deps ??= dependenciasReais());
  }

  get ocupado(): boolean {
    return this.ocupadoAgora;
  }

  /** Os toques em "Gravar" e "Parar": ignorados enquanto um pedido ou uma parada está em andamento. Devolve o resultado do início, ou nulo se parou ou se ignorou o toque. */
  async alternar(filtro: FiltroDeRuido): Promise<ResultadoDeIniciar | null> {
    if (this.ocupadoAgora) return null;
    this.ocupadoAgora = true;
    try {
      if (this.gravando) {
        await this.parar();
        return null;
      }
      return await this.iniciar(filtro);
    } finally {
      this.ocupadoAgora = false;
    }
  }

  async iniciar(filtro: FiltroDeRuido): Promise<ResultadoDeIniciar> {
    const d = this.d;
    const minha = ++this.tentativa;
    this.perdida = null;
    if (!d.foneConectado()) d.calarSons();
    let filtroFalhou: FiltroDeRuido | null = null;
    try {
      const aplicado = await this.gravador.iniciar({ filtro }); // `filtro` já é o valor fixado no toque: a pessoa pode mexer na escolha enquanto o microfone e o filtro carregam
      if (aplicado !== filtro && minha === this.tentativa) filtroFalhou = filtro; // o filtro neural não carregou: a gravação segue sem filtro
    } catch (e) {
      console.warn("gravador: não foi possível gravar", e);
      return { cancelada: minha !== this.tentativa, erro: minha === this.tentativa ? motivoDoErro(e) : null, filtroFalhou: null };
    }
    if (minha !== this.tentativa) {
      this.gravador.soltar(); // a pessoa já saiu ou mandou parar enquanto o aparelho liberava o microfone
      return { cancelada: true, erro: null, filtroFalhou: null };
    }
    this.contextoDoInicio = d.lerContexto();
    this.gravando = true;
    this.protegida = d.servico.ligar();
    this.decorrido = 0;
    const comeco = d.agora();
    this.relogio = setInterval(() => (this.decorrido = (d.agora() - comeco) / 1000), 250);
    this.detector.reiniciar(d.agora());
    this.medidor = setInterval(() => {
      const atual = this.gravador.nivel();
      this.nivel = suavizarBarra(this.nivel, nivelParaBarra(atual));
      const r = this.detector.atualizar(atual, d.agora());
      if (r.comSom) this.ouviu = true;
      // Sem medidor (sem AudioContext, ou o navegador o deixou suspenso), o nível é sempre 0: isso não prova que não há som, então não avisa.
      this.semSom = this.gravador.medidorAtivo && r.semSom;
    }, 80);
    this.abrirSessao();
    this.ouvintes.push(
      // O botão "Parar" da notificação do Android.
      d.servico.aoParar(() => {
        if (this.gravando) void this.parar();
      }),
      // O serviço do Android não subiu (a ponte avisa depois de já ter dito que sim): sem ele a gravação não está protegida. Com a página escondida o microfone já se foi, então para e guarda o que houver.
      d.servico.aoFalhar(() => {
        this.protegida = false;
        if (this.gravando && d.pagina.escondida()) void this.parar();
      }),
      // App em segundo plano: para uma gravação EM CURSO e devolve o microfone, a menos que o Android a tenha assumido com o serviço (`protegida`).
      d.pagina.aoMudar(() => {
        if (d.pagina.escondida() && this.gravando && !this.protegida) void this.parar();
      }),
    );
    // O app já estava em segundo plano quando o microfone chegou (a permissão já estava dada e a pessoa saiu antes): o evento de esconder já passou.
    // Espera um instante antes de parar, porque o diálogo de permissão do Android também esconde a página por um momento.
    if (d.pagina.escondida() && !this.protegida) setTimeout(() => (this.gravando && d.pagina.escondida() ? void this.parar() : undefined), 1000);
    return { cancelada: false, erro: null, filtroFalhou };
  }

  async parar(): Promise<void> {
    if (!this.gravando) return; // outra parada já está em andamento
    const d = this.d;
    const contexto = marcarMudanca(this.contextoDoInicio, d.lerContexto()); // antes de qualquer espera: o que mudar enquanto o arquivo fecha não conta
    const sessao = this.sessao;
    this.sessao = null;
    this.tentativa++;
    this.pararRelogio();
    this.gravando = false;
    this.protegida = false;
    d.servico.desligar();
    this.soltarOuvintes();
    const nova = await this.gravador.parar();
    this.gravador.aoPedaco = null;
    if (!nova) {
      this.descartarSessao(sessao); // nada chegou: não há o que recuperar
      this.entregar({ tipo: "vazia" });
      return;
    }
    await this.guardar(nova, contexto, sessao);
  }

  /** A aba do Gravador saiu de cena: cancela um pedido de microfone que esperava, ou para a gravação, e DEVOLVE o microfone. O que já foi gravado fica. */
  async sair(): Promise<void> {
    if (!this.gravando) {
      this.tentativa++;
      this.gravador.soltar();
      return;
    }
    await this.parar();
  }

  /**
   * A tela do Gravador foi desmontada (a pessoa abriu um hino, por exemplo). Com o serviço do Android assumindo a gravação, ela SEGUE (o aviso "Gravando · Parar" aparece na tela do hino);
   * sem ele, para e GUARDA o que foi gravado, e um pedido de microfone que ainda esperava é jogado fora quando chegar.
   */
  aoDesmontarATela(): void {
    this.aoTerminar = null;
    if (this.gravando && this.protegida) return;
    if (this.gravando) void this.parar();
    else {
      this.tentativa++;
      this.gravador.soltar();
    }
  }

  /** Na abertura da tela: toda gravação que ficou pela metade (o app caiu) vira uma gravação guardada. Devolve quantas foram recuperadas. */
  async recuperar(): Promise<number> {
    const emUso = this.sessao ? await this.sessao : null; // a que está gravando agora não é uma sobra
    const recuperadas = await this.d.armazenamento.recuperarSessoes(emUso ? [emUso] : []);
    return recuperadas.length;
  }

  // ---- por dentro ----

  private pararRelogio() {
    if (this.relogio !== null) clearInterval(this.relogio);
    this.relogio = null;
    if (this.medidor !== null) clearInterval(this.medidor);
    this.medidor = null;
    this.nivel = 0;
    this.ouviu = false;
    this.semSom = false;
  }

  private soltarOuvintes() {
    for (const desfazer of this.ouvintes.splice(0)) desfazer();
  }

  /** Abre a sessão de recuperação e liga o gravador a ela: cada pedaço que chega (um por segundo) é guardado na hora. Falhar aqui não atrapalha a gravação. */
  private abrirSessao() {
    const armazenamento = this.d.armazenamento;
    const aberta = armazenamento.abrirSessao(this.gravador.tipo || "audio/webm", this.contextoDoInicio).then(
      (id): string | null => id,
      (e) => {
        console.warn("gravador: não foi possível abrir a sessão de recuperação", e);
        return null;
      },
    );
    this.sessao = aberta;
    this.gravador.aoPedaco = (indice, pedaco) => {
      void aberta.then((id) => (id ? armazenamento.guardarPedaco(id, indice, pedaco) : undefined)).catch((e) => console.warn("gravador: não foi possível guardar um pedaço", e));
    };
  }

  private descartarSessao(sessao: Promise<string | null> | null) {
    void sessao?.then((id) => (id ? this.d.armazenamento.descartarSessao(id) : undefined)).catch((e) => console.warn("gravador: não foi possível apagar a sessão de recuperação", e));
  }

  /** Guarda a gravação (com prazo). Se não der, ela fica à mão (na tela do Gravador, se há uma) e a sessão de recuperação NÃO é apagada: a próxima abertura do app ainda a recupera. */
  private async guardar(nova: Gravacao, contexto: ContextoGravacao | null, sessao: Promise<string | null> | null) {
    rastro(`guardando ${nova.bytes} bytes`);
    const comeco = this.d.agora();
    const r = await guardarComPrazo(this.d.armazenamento.salvar(nova.blob, nova.tipo, nova.segundos, contexto));
    if (r.guardada) {
      rastro(`guardada em ${Math.round(this.d.agora() - comeco)} ms`);
      URL.revokeObjectURL(nova.url); // o arquivo já está no armazenamento; a lista o lê de lá quando a pessoa tocar em Ouvir
      this.descartarSessao(sessao);
      this.entregar({ tipo: "guardada", meta: r.meta });
      return;
    }
    console.warn("gravador: não foi possível guardar a gravação", r.demorou ? "(demorou demais)" : "");
    void r.depois.then(
      () => this.descartarSessao(sessao), // a escrita terminou depois do prazo: a gravação está guardada, a sessão não precisa mais
      () => {},
    );
    this.entregar({ tipo: "nao-guardada", gravacao: nova, demorou: r.demorou, depois: r.depois });
  }

  /** Entrega o resultado à tela do Gravador. Sem ela (a pessoa está em outra tela), o que não foi guardado vira o aviso `perdida`, que a tela inicial mostra. */
  private entregar(resultado: Resultado) {
    if (this.aoTerminar) {
      this.aoTerminar(resultado);
      return;
    }
    if (resultado.tipo !== "nao-guardada") return;
    URL.revokeObjectURL(resultado.gravacao.url); // ninguém vai ouvir esta gravação na tela
    this.perdida = resultado.demorou ? "incerta" : "falhou";
    resultado.depois.then(
      () => {
        if (this.perdida === "incerta") this.perdida = null; // a escrita terminou bem
      },
      () => {
        this.perdida = "falhou";
      },
    );
  }
}

export const emCurso = new GravacaoEmCurso();
