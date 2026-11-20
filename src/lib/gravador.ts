// Gravador de áudio (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho: a gravação fica na memória do app
// até a pessoa descartá-la ou sair. A parte pura (escolha do formato e os textos de tempo e tamanho) se testa no Vitest; o resto liga a API do
// navegador (`getUserMedia` e `MediaRecorder`), que no WebView do Android depende de o aplicativo ter a permissão de microfone.

/** Formatos que se tenta, do preferido ao último recurso: Opus é compacto e o que o responsável pediu; MP4 e WebM são o que o navegador sabe gravar. */
export const FORMATOS_PREFERIDOS = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"] as const;

/** O primeiro formato preferido que o navegador grava; nulo se nenhum (o `MediaRecorder` então escolhe o seu). `aceita` é o `MediaRecorder.isTypeSupported`. */
export function escolherFormato(aceita: (tipo: string) => boolean): string | null {
  for (const tipo of FORMATOS_PREFERIDOS) if (aceita(tipo)) return tipo;
  return null;
}

/** 0:07, 1:05, 12:30 (minutos sem zero à esquerda, segundos com dois dígitos). Valor inválido ou negativo vale 0:00. */
export function formatarTempo(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "340 B", "12,3 KB", "1,8 MB" (separador decimal do idioma). */
export function formatarTamanho(bytes: number, idioma: string): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const num = (v: number) => new Intl.NumberFormat(idioma, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1023.95) return `${num(n / 1024)} KB`; // abaixo disso arredondaria para "1.024,0 KB"
  return `${num(n / (1024 * 1024))} MB`;
}

/** Nome curto do tipo gravado, sem os parâmetros: "audio/webm;codecs=opus" vira "webm (opus)". */
export function nomeDoFormato(tipo: string): string {
  const [base, ...params] = tipo.split(";").map((p) => p.trim());
  const container = base.replace(/^audio\//, "") || "?";
  const codec = params.find((p) => p.startsWith("codecs="))?.slice(7).replace(/"/g, "");
  return codec ? `${container} (${codec})` : container;
}

/** Por que a gravação não começou: a pessoa negou a permissão, não há microfone, ou o aparelho/navegador não grava. */
export type MotivoDoErro = "negada" | "sem_microfone" | "indisponivel" | "falhou";

/** Traduz o erro do navegador no motivo que a tela explica. */
export function motivoDoErro(e: unknown): MotivoDoErro {
  const nome = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") return "negada";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "sem_microfone";
  if (nome === "NotSupportedError" || nome === "TypeError") return "indisponivel";
  return "falhou";
}

// ---- Medidor de som (o que o microfone está ouvindo) ----

/** Abaixo de −60 dBFS o medidor mostra silêncio; 0 dBFS é o fundo de escala (o máximo que o microfone entrega). */
export const PISO_DB = -60;

/** O nível de 0 a 1 que a barra mostra, a partir do RMS das amostras (−1 a 1), em escala de decibéis (é assim que o ouvido percebe volume). */
export function nivelDeRms(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) - PISO_DB) / -PISO_DB));
}

/** A barra do botão mostra só a faixa útil da voz: de −50 dBFS (quase silêncio) a −8 dBFS (alto); fora dela, vazia ou cheia. */
export const BARRA_PISO_DB = -50;
export const BARRA_TETO_DB = -8;

/** Converte o nível do medidor (0 a 1, escala de −60 a 0 dBFS) para a escala da barra, mais estreita, e com uma curva de cosseno (0 → 0, 0,25 → 0,15, 0,5 → 0,5, 1 → 1), para ela balançar menos. */
export function nivelParaBarra(nivel: number): number {
  if (!Number.isFinite(nivel)) return 0;
  const db = Math.min(1, Math.max(0, nivel)) * -PISO_DB + PISO_DB;
  const x = Math.min(1, Math.max(0, (db - BARRA_PISO_DB) / (BARRA_TETO_DB - BARRA_PISO_DB)));
  return (1 - Math.cos(Math.PI * x)) / 2; // curva de cosseno: achata as pontas (sussurro e grito mexem menos), o meio fica igual
}

/** Cada quadro (80 ms) a barra cai a esta fração do que estava: meia-vida de uns 0,4 s. Sobe rápido, cai devagar, como medidor de estúdio. */
export const QUEDA_DA_BARRA = 0.88;
const SUBIDA_DA_BARRA = 0.6;

/** Próximo valor da barra: sobe 60% do caminho até o nível novo, e cai devagar quando ele é menor. */
export function suavizarBarra(anterior: number, atual: number): number {
  return atual >= anterior ? anterior + (atual - anterior) * SUBIDA_DA_BARRA : Math.max(atual, anterior * QUEDA_DA_BARRA);
}

/** Raiz da média dos quadrados das amostras (a "força" do som). Sem amostras, 0. */
export function rmsDeAmostras(amostras: ArrayLike<number>): number {
  const n = amostras.length;
  if (n === 0) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += amostras[i] * amostras[i];
  return Math.sqrt(soma / n);
}

/** Nível a partir do qual conta como "tem som" (cerca de −48 dBFS: acima do chiado de um microfone parado, abaixo de uma voz baixa). */
export const LIMIAR_SOM = 0.2;
/** Quanto tempo sem som até avisar que o microfone não está ouvindo nada. */
export const SILENCIO_MS = 3000;

/**
 * Acompanha o nível do microfone e diz se há som agora e se faz tempo demais que não há (para avisar "não estou ouvindo nada"). O tempo vem de fora
 * (`agora`, em milissegundos), o que deixa a conta testável. `reiniciar` marca o começo de uma gravação.
 */
export class DetectorDeSom {
  private ultimoSom = 0;
  constructor(
    private readonly limiar = LIMIAR_SOM,
    private readonly silencioMs = SILENCIO_MS,
  ) {}

  reiniciar(agora: number): void {
    this.ultimoSom = agora;
  }

  atualizar(nivel: number, agora: number): { comSom: boolean; semSom: boolean } {
    const comSom = nivel >= this.limiar;
    if (comSom) this.ultimoSom = agora;
    return { comSom, semSom: agora - this.ultimoSom >= this.silencioMs };
  }
}

/** 64 kbps: bom para voz e instrumento e compacto (o padrão do navegador gravava a cerca de 135 kbps, o dobro, sem ganho que se ouça). */
export const BITS_POR_SEGUNDO = 64000;

/**
 * O WebM gravado ao vivo não traz a duração: o player acha que é infinita e a barra de progresso fica errada. O remédio conhecido do Chromium é
 * pular para um ponto absurdo, o que o obriga a ler o arquivo e descobrir o fim, e voltar ao começo. Devolve a função que desfaz o ouvinte.
 */
export function corrigirDuracao(audio: HTMLAudioElement): () => void {
  const aoCarregar = () => {
    if (audio.duration !== Infinity) return;
    const volta = () => {
      audio.removeEventListener("timeupdate", volta);
      audio.currentTime = 0;
    };
    audio.addEventListener("timeupdate", volta);
    audio.currentTime = 1e101;
  };
  audio.addEventListener("loadedmetadata", aoCarregar);
  return () => audio.removeEventListener("loadedmetadata", aoCarregar);
}

export type Gravacao = { url: string; blob: Blob; tipo: string; bytes: number; segundos: number };

/**
 * Uma sessão de gravação do microfone. `iniciar` pede o microfone (a permissão é pedida aqui, a partir de um toque), `parar` entrega o arquivo e
 * `soltar` devolve o microfone ao aparelho na hora (também ao esconder o app). Sem efeitos de voz (cancelamento de eco, supressão de ruído e
 * ganho automático desligados) para o som sair como foi tocado ou cantado. Quem usa deve evitar chamadas ao mesmo tempo (a tela ignora toques
 * enquanto um pedido ou uma parada está em andamento).
 */
/** Um rastro leve do que o gravador faz (console.debug): quando algo trava só no CI, é isto que mostra em que passo. */
export const rastro = (mensagem: string) => console.debug(`gravador: ${mensagem}`);

/** Quanto se espera o aviso de que o MediaRecorder parou antes de entregar o que já foi gravado (ms). */
export const LIMITE_PARA_PARAR_MS = 4000;

export class Gravador {
  private fluxo: MediaStream | null = null;
  private gravador: MediaRecorder | null = null;
  /** Medidor de nível: um `AudioContext` só para escutar o microfone (não toca nada), com o analisador e o buffer de amostras. */
  private contexto: AudioContext | null = null;
  private analisador: AnalyserNode | null = null;
  private amostras: Float32Array<ArrayBuffer> | null = null;
  private pedacos: Blob[] = [];
  private inicio = 0;
  /** Quando a gravação terminou (por `parar` ou porque a trilha do microfone acabou); 0 enquanto grava. */
  private fim = 0;
  /** Formato em uso; conhecido depois de `iniciar`. */
  tipo = "";
  /** Avisa quem usa quando a gravação PARA SOZINHA (ligação, outro app pegou o microfone, permissão revogada, erro do gravador): ele chama `parar` para guardar o que já foi gravado. */
  aoInterromper: (() => void) | null = null;

  get gravando(): boolean {
    return this.gravador?.state === "recording";
  }

  async iniciar(): Promise<void> {
    if (this.gravando) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new DOMException("sem gravação", "NotSupportedError");
    // O contexto do medidor nasce AGORA, no toque (o navegador só deixa o áudio iniciar depois de um gesto), e não depois da espera pela permissão.
    this.abrirMedidor();
    try {
      this.fluxo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      this.soltar();
      throw e;
    }
    try {
      this.ligarMedidor(this.fluxo);
      const preferido = escolherFormato((t) => MediaRecorder.isTypeSupported(t));
      this.gravador = preferido
        ? new MediaRecorder(this.fluxo, { mimeType: preferido, audioBitsPerSecond: BITS_POR_SEGUNDO })
        : new MediaRecorder(this.fluxo, { audioBitsPerSecond: BITS_POR_SEGUNDO });
      this.tipo = this.gravador.mimeType || preferido || "";
      this.pedacos = [];
      this.fim = 0;
      this.gravador.ondataavailable = (e) => {
        if (e.data.size > 0) this.pedacos.push(e.data);
      };
      const interrompida = () => {
        if (this.fim === 0) this.fim = performance.now();
        this.aoInterromper?.();
      };
      this.gravador.onerror = interrompida;
      // `stop()` da trilha (o nosso) não dispara "ended"; este evento só chega quando o SISTEMA tira o microfone.
      this.fluxo.getTracks().forEach((t) => t.addEventListener("ended", interrompida));
      this.gravador.start(1000); // um pedaço por segundo: uma queda no meio ainda deixa o que já foi gravado
      this.inicio = performance.now();
      rastro(`gravando (${this.tipo || "formato do navegador"})`);
    } catch (e) {
      this.soltar();
      throw e;
    }
  }

  /**
   * O medidor está funcionando (há analisador e o contexto de áudio está rodando). Sem ele, `nivel()` devolve sempre 0, e quem usa NÃO deve tirar
   * disso a conclusão de que "não há som": o aviso de "sem som" só vale com o medidor ativo.
   */
  get medidorAtivo(): boolean {
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

  private abrirMedidor(): void {
    try {
      const g = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Contexto = g.AudioContext ?? g.webkitAudioContext; // WebViews e Safari antigos só têm o nome com prefixo
      if (!Contexto) return;
      this.contexto = new Contexto();
      void this.contexto.resume().catch(() => {});
    } catch {
      this.contexto = null; // sem medidor, a gravação segue igual
    }
  }

  private ligarMedidor(fluxo: MediaStream): void {
    if (!this.contexto) return;
    try {
      this.analisador = this.contexto.createAnalyser();
      this.analisador.fftSize = 1024;
      this.amostras = new Float32Array(new ArrayBuffer(this.analisador.fftSize * 4));
      // Só escuta: a fonte NÃO vai para a saída (senão o microfone tocaria no alto-falante).
      this.contexto.createMediaStreamSource(fluxo).connect(this.analisador);
    } catch {
      this.analisador = null;
      this.amostras = null;
    }
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
      // Se o "stop" do gravador nunca chega (visto no CI: a gravação para, o microfone volta e nada entra na lista, sem erro na tela), a espera não pode ser
      // eterna: passado o limite, entrega o que já foi gravado (os pedaços de cada segundo), ou nulo, e a tela mostra o erro.
      let entregue = false;
      const entregar = (porLimite: boolean) => {
        if (entregue) return;
        entregue = true;
        clearTimeout(limite);
        if (porLimite) console.warn("gravador: o MediaRecorder não avisou que parou; entregando o que já estava gravado");
        else rastro("o gravador avisou que parou");
        ok(this.entregar());
      };
      const limite = setTimeout(() => entregar(true), LIMITE_PARA_PARAR_MS);
      g.onstop = () => entregar(false);
      if (this.fim === 0) this.fim = performance.now();
      try {
        g.stop();
      } catch {
        entregar(false); // já estava parado
      }
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
    if (this.gravador && this.gravador.state !== "inactive") {
      this.gravador.onstop = null;
      try {
        this.gravador.stop();
      } catch {
        /* já parado */
      }
    }
    this.gravador = null;
    this.pedacos = [];
    this.analisador = null;
    this.amostras = null;
    void this.contexto?.close().catch(() => {});
    this.contexto = null;
  }
}
