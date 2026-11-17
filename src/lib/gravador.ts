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
  if (n < 1024 * 1024) return `${num(n / 1024)} KB`;
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

export type Gravacao = { url: string; tipo: string; bytes: number; segundos: number };

/**
 * Uma sessão de gravação do microfone. `iniciar` pede o microfone (a permissão é pedida aqui, a partir de um toque), `parar` entrega o arquivo e
 * `soltar` devolve o microfone ao aparelho na hora (também ao esconder o app). Sem efeitos de voz (cancelamento de eco, supressão de ruído e
 * ganho automático desligados) para o som sair como foi tocado ou cantado.
 */
export class Gravador {
  private fluxo: MediaStream | null = null;
  private gravador: MediaRecorder | null = null;
  private pedacos: Blob[] = [];
  private inicio = 0;
  /** Formato em uso; conhecido depois de `iniciar`. */
  tipo = "";

  get gravando(): boolean {
    return this.gravador?.state === "recording";
  }

  async iniciar(): Promise<void> {
    if (this.gravando) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new DOMException("sem gravação", "NotSupportedError");
    this.fluxo = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    try {
      const preferido = escolherFormato((t) => MediaRecorder.isTypeSupported(t));
      this.gravador = preferido
        ? new MediaRecorder(this.fluxo, { mimeType: preferido, audioBitsPerSecond: BITS_POR_SEGUNDO })
        : new MediaRecorder(this.fluxo, { audioBitsPerSecond: BITS_POR_SEGUNDO });
      this.tipo = this.gravador.mimeType || preferido || "";
      this.pedacos = [];
      this.gravador.ondataavailable = (e) => {
        if (e.data.size > 0) this.pedacos.push(e.data);
      };
      this.gravador.start(1000); // um pedaço por segundo: uma queda no meio ainda deixa o que já foi gravado
      this.inicio = performance.now();
    } catch (e) {
      this.soltar();
      throw e;
    }
  }

  /** Para e entrega o arquivo (ou nulo se não chegou nada). O microfone é devolvido ao aparelho. */
  parar(): Promise<Gravacao | null> {
    const g = this.gravador;
    if (!g || g.state === "inactive") {
      this.soltar();
      return Promise.resolve(null);
    }
    const segundos = (performance.now() - this.inicio) / 1000;
    return new Promise((ok) => {
      g.onstop = () => {
        const tipo = this.tipo || g.mimeType || "audio/webm";
        const blob = new Blob(this.pedacos, { type: tipo });
        this.soltar();
        ok(blob.size > 0 ? { url: URL.createObjectURL(blob), tipo, bytes: blob.size, segundos } : null);
      };
      g.stop();
    });
  }

  /** Devolve o microfone ao aparelho (apaga o ícone de gravação do Android) e esquece o gravador. */
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
  }
}
