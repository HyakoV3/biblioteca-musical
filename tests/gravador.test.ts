import { afterEach, describe, expect, it, vi } from "vitest";
import { FORMATOS_PREFERIDOS, Gravador, corrigirDuracao, escolherFormato, formatarTamanho, formatarTempo, motivoDoErro, nomeDoFormato } from "../src/lib/gravador";

describe("formato da gravação", () => {
  it("escolhe o primeiro formato preferido que o navegador grava", () => {
    expect(escolherFormato(() => true)).toBe("audio/ogg;codecs=opus");
    expect(escolherFormato((t) => t === "audio/webm;codecs=opus" || t === "audio/webm")).toBe("audio/webm;codecs=opus");
    expect(escolherFormato((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(escolherFormato((t) => t === "audio/webm")).toBe("audio/webm");
  });
  it("sem nenhum, devolve nulo (o MediaRecorder escolhe o seu)", () => {
    expect(escolherFormato(() => false)).toBeNull();
  });
  it("o Opus vem antes do resto", () => {
    expect(FORMATOS_PREFERIDOS[0]).toContain("opus");
  });
  it("nome curto do formato, sem os parâmetros", () => {
    expect(nomeDoFormato("audio/webm;codecs=opus")).toBe("webm (opus)");
    expect(nomeDoFormato("audio/mp4")).toBe("mp4");
    expect(nomeDoFormato('audio/ogg; codecs="opus"')).toBe("ogg (opus)");
    expect(nomeDoFormato("")).toBe("?");
  });
});

describe("tempo e tamanho", () => {
  it("tempo em minutos e segundos", () => {
    expect(formatarTempo(0)).toBe("0:00");
    expect(formatarTempo(7.9)).toBe("0:07");
    expect(formatarTempo(65)).toBe("1:05");
    expect(formatarTempo(750)).toBe("12:30");
  });
  it("tempo inválido ou negativo vale 0:00", () => {
    for (const v of [-3, NaN, Infinity, undefined as unknown as number]) expect(formatarTempo(v)).toBe("0:00");
  });
  it("tamanho em B, KB e MB, com o separador do idioma", () => {
    expect(formatarTamanho(340, "pt")).toBe("340 B");
    expect(formatarTamanho(12595, "pt")).toBe("12,3 KB");
    expect(formatarTamanho(12595, "en")).toBe("12.3 KB");
    expect(formatarTamanho(1887437, "pt")).toBe("1,8 MB");
    expect(formatarTamanho(-1, "pt")).toBe("0 B");
  });
  it("logo abaixo de 1 MB não vira \"1.024,0 KB\"", () => {
    expect(formatarTamanho(1048575, "pt")).toBe("1,0 MB");
    expect(formatarTamanho(1048576, "pt")).toBe("1,0 MB");
    expect(formatarTamanho(1023 * 1024, "pt")).toBe("1.023,0 KB");
  });
});

describe("motivo do erro", () => {
  const erro = (name: string) => Object.assign(new Error("x"), { name });
  it("traduz o erro do navegador", () => {
    expect(motivoDoErro(erro("NotAllowedError"))).toBe("negada");
    expect(motivoDoErro(erro("SecurityError"))).toBe("negada");
    expect(motivoDoErro(erro("NotFoundError"))).toBe("sem_microfone");
    expect(motivoDoErro(erro("NotSupportedError"))).toBe("indisponivel");
    expect(motivoDoErro(erro("AbortError"))).toBe("falhou");
  });
  it("o que não é erro conhecido vira falha", () => {
    expect(motivoDoErro("texto")).toBe("falhou");
    expect(motivoDoErro(null)).toBe("falhou");
    expect(motivoDoErro({ name: "NotAllowedError" })).toBe("negada");
  });
});

describe("duração do WebM gravado ao vivo", () => {
  it("o bitrate é compacto, de voz", async () => {
    const { BITS_POR_SEGUNDO } = await import("../src/lib/gravador");
    expect(BITS_POR_SEGUNDO).toBe(64000);
  });

  // Um <audio> falso: só o que `corrigirDuracao` toca (eventos, `duration` e `currentTime`).
  class AudioFalso extends EventTarget {
    duration = Infinity;
    currentTime = 0;
  }
  const comoAudio = (a: AudioFalso) => a as unknown as HTMLAudioElement;

  it("duração infinita: pula para um ponto absurdo para o navegador descobrir o fim e volta ao começo", () => {
    const a = new AudioFalso();
    corrigirDuracao(comoAudio(a));
    a.dispatchEvent(new Event("loadedmetadata"));
    expect(a.currentTime).toBe(1e101);
    a.duration = 2.2; // o navegador descobriu a duração
    a.dispatchEvent(new Event("timeupdate"));
    expect(a.currentTime).toBe(0);
    a.currentTime = 1.5; // outro timeupdate (a pessoa ouvindo): não pode voltar a zero
    a.dispatchEvent(new Event("timeupdate"));
    expect(a.currentTime).toBe(1.5);
  });

  it("duração já conhecida: não mexe no player", () => {
    const a = new AudioFalso();
    a.duration = 3;
    corrigirDuracao(comoAudio(a));
    a.dispatchEvent(new Event("loadedmetadata"));
    expect(a.currentTime).toBe(0);
  });

  it("a função devolvida desfaz o ouvinte", () => {
    const a = new AudioFalso();
    const desfazer = corrigirDuracao(comoAudio(a));
    desfazer();
    a.dispatchEvent(new Event("loadedmetadata"));
    expect(a.currentTime).toBe(0);
  });
});

describe("Gravador (com um MediaRecorder falso)", () => {
  class Trilha extends EventTarget {
    parou = false;
    stop() {
      this.parou = true; // parar a trilha pelo código não dispara "ended", como no navegador
    }
  }
  class RecorderFalso {
    static ultimo: RecorderFalso | null = null;
    static isTypeSupported = () => true;
    state: "inactive" | "recording" = "inactive";
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_fluxo: unknown, opcoes?: { mimeType?: string; audioBitsPerSecond?: number }) {
      this.mimeType = opcoes?.mimeType ?? "audio/webm";
      RecorderFalso.ultimo = this;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => this.onstop?.());
    }
    entregar(bytes: number) {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
    }
  }
  let trilha: Trilha;
  function preparar() {
    trilha = new Trilha();
    vi.stubGlobal("MediaRecorder", RecorderFalso);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [trilha] }) } });
  }
  afterEach(() => {
    vi.unstubAllGlobals();
    RecorderFalso.ultimo = null;
  });

  it("grava, para e entrega o arquivo, devolvendo o microfone", async () => {
    preparar();
    const g = new Gravador();
    await g.iniciar();
    expect(g.gravando).toBe(true);
    RecorderFalso.ultimo!.entregar(400);
    RecorderFalso.ultimo!.entregar(600);
    const r = await g.parar();
    expect(r?.bytes).toBe(1000);
    expect(r?.tipo).toBe("audio/ogg;codecs=opus");
    expect(trilha.parou).toBe(true);
    expect(g.gravando).toBe(false);
    if (r) URL.revokeObjectURL(r.url);
  });

  it("depois de entregar, o gravador não guarda os pedaços na memória", async () => {
    preparar();
    const g = new Gravador();
    await g.iniciar();
    RecorderFalso.ultimo!.entregar(500);
    const r = await g.parar();
    expect((g as unknown as { pedacos: Blob[] }).pedacos).toHaveLength(0);
    if (r) URL.revokeObjectURL(r.url);
  });

  it("se a gravação para sozinha (o sistema tirou o microfone), avisa e `parar` ainda entrega o que foi gravado", async () => {
    preparar();
    const g = new Gravador();
    const avisos = vi.fn();
    g.aoInterromper = avisos;
    await g.iniciar();
    const rec = RecorderFalso.ultimo!;
    rec.entregar(700);
    rec.state = "inactive"; // o recorder parou por conta própria
    trilha.dispatchEvent(new Event("ended"));
    expect(avisos).toHaveBeenCalledTimes(1);
    const r = await g.parar();
    expect(r?.bytes).toBe(700);
    if (r) URL.revokeObjectURL(r.url);
  });

  it("um erro do gravador também avisa", async () => {
    preparar();
    const g = new Gravador();
    const avisos = vi.fn();
    g.aoInterromper = avisos;
    await g.iniciar();
    RecorderFalso.ultimo!.onerror?.();
    expect(avisos).toHaveBeenCalledTimes(1);
    g.soltar();
  });

  it("parar sem nada gravado devolve nulo, e parar sem ter iniciado também", async () => {
    preparar();
    const g = new Gravador();
    expect(await g.parar()).toBeNull();
    await g.iniciar();
    expect(await g.parar()).toBeNull();
  });

  it("soltar devolve o microfone e esquece tudo", async () => {
    preparar();
    const g = new Gravador();
    await g.iniciar();
    RecorderFalso.ultimo!.entregar(300);
    g.soltar();
    expect(trilha.parou).toBe(true);
    expect((g as unknown as { pedacos: Blob[] }).pedacos).toHaveLength(0);
    expect(await g.parar()).toBeNull();
  });
});
