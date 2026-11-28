// A gravação em curso, UMA para o app todo (ARQ-003, GRV-001). O ciclo de vida da gravação (pedir o microfone, o relógio e o medidor, parar, guardar, recuperar) mora aqui, e não no componente
// `Gravador.svelte`: a tela inicial é desmontada ao abrir um hino, e, com o serviço do Android assumindo a gravação, ela TEM de seguir (como o clique do metrônomo, que também vive fora da tela).
// O componente só mostra o estado e, quando existe, recebe o resultado em `aoTerminar` (para pôr a gravação nova na lista). Sem componente por perto, o resultado vira o aviso `perdida`.
import { marcarMudanca, type ContextoGravacao } from "./contexto";
import type { FiltroDeRuido } from "./filtroDeRuido";
import { Gravador } from "./gravador";
import { SessoesDeRecuperacao, guardarGravacao } from "./gravacaoSessoes";
import { ligarOuvintes, pedirMicrofone } from "./gravacaoMicrofone";
import { Medicao } from "./gravacaoMedicao";
import { dependenciasReais, entregarResultado, guardarComPrazo, type Dependencias, type Resultado, type ResultadoDeIniciar } from "./gravacaoEmCursoDeps";

// A API pública continua aqui: os componentes e os testes importam tudo de `gravacaoEmCurso.svelte`.
export { guardarComPrazo, type Dependencias, type Resultado, type ResultadoDeIniciar, type ResultadoDoGuardar } from "./gravacaoEmCursoDeps";

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
  private readonly medicao: Medicao;
  private readonly sessoes = new SessoesDeRecuperacao(() => this.d.armazenamento);
  /** Numera os pedidos: uma resposta tardia do microfone não vale se a pessoa já mandou parar ou saiu da aba. */
  private tentativa = 0;
  /** Um pedido de microfone ou uma parada está em andamento: os toques em "Gravar" e "Parar" são ignorados até acabar (dois pedidos juntos deixavam um microfone órfão). */
  private ocupadoAgora = false;
  /** O contexto do instante em que a gravação começou; ao parar (lido ANTES de qualquer espera), vira o contexto guardado, com a marca de que algo mudou, se mudou. */
  private contextoDoInicio: ContextoGravacao | null = null;
  private ouvintes: (() => void)[] = [];
  private deps: Dependencias | null;

  constructor(deps?: Dependencias) {
    this.deps = deps ?? null;
    this.gravador = this.d.criarGravador();
    this.medicao = new Medicao(this, this.gravador, () => this.d.agora());
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
    const pedido = await pedirMicrofone(this.gravador, filtro, () => minha === this.tentativa);
    if ("erro" in pedido) return pedido.erro;
    if (minha !== this.tentativa) {
      this.gravador.soltar(); // a pessoa já saiu ou mandou parar enquanto o aparelho liberava o microfone
      return { cancelada: true, erro: null, filtroFalhou: null };
    }
    // O microfone chegou e a pessoa ainda quer gravar: liga o estado, o serviço, a medição, a sessão de recuperação e os ouvintes.
    this.contextoDoInicio = d.lerContexto();
    this.gravando = true;
    this.protegida = d.servico.ligar();
    this.medicao.iniciar();
    this.sessoes.abrir(this.gravador, this.contextoDoInicio);
    this.ouvintes.push(...ligarOuvintes(d, this));
    // O app já estava em segundo plano quando o microfone chegou (a permissão já estava dada e a pessoa saiu antes): o evento de esconder já passou.
    // Espera um instante antes de parar, porque o diálogo de permissão do Android também esconde a página por um momento.
    if (d.pagina.escondida() && !this.protegida) setTimeout(() => (this.gravando && d.pagina.escondida() ? void this.parar() : undefined), 1000);
    return { cancelada: false, erro: null, filtroFalhou: pedido.filtroFalhou };
  }

  async parar(): Promise<void> {
    if (!this.gravando) return; // outra parada já está em andamento
    const contexto = marcarMudanca(this.contextoDoInicio, this.d.lerContexto()); // antes de qualquer espera: o que mudar enquanto o arquivo fecha não conta
    const sessao = this.encerrar();
    const nova = await this.gravador.parar();
    this.gravador.aoPedaco = null;
    if (!nova) {
      this.sessoes.esquecer(sessao); // nada chegou: não há o que recuperar
      entregarResultado(this, { tipo: "vazia" });
      return;
    }
    entregarResultado(this, await guardarGravacao(this.d, this.sessoes, { nova, contexto, sessao }));
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
    const recuperadas = await this.d.armazenamento.recuperarSessoes(await this.sessoes.emUso());
    return recuperadas.length;
  }

  /** Apaga a sessão de recuperação (e os pedaços dela). Usado quando a gravação está guardada por outro caminho, ou quando a pessoa descarta a que não pôde ser guardada. */
  esquecerSessao = (sessao: Promise<string | null> | null): void => this.sessoes.esquecer(sessao);

  // ---- por dentro ----

  /** O lado síncrono da parada: tira a gravação de cena (relógio, estado, serviço, ouvintes) e devolve a sessão de recuperação dela, que passa a "fechando". */
  private encerrar(): Promise<string | null> | null {
    const sessao = this.sessoes.fechar();
    this.tentativa++;
    this.medicao.parar();
    this.gravando = false;
    this.protegida = false;
    this.d.servico.desligar();
    for (const desfazer of this.ouvintes.splice(0)) desfazer();
    return sessao;
  }
}

export const emCurso = new GravacaoEmCurso();
