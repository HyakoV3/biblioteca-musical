import { afterEach, describe, expect, it, vi } from "vitest";
import { DetectorDeSom, FORMATOS_PREFERIDOS, Gravador, LIMIAR_SOM, LIMITE_PARA_PARAR_MS, PISO_DB, QUEDA_DA_BARRA, SILENCIO_MS, corrigirDuracao, escolherFormato, formatarTamanho, formatarTempo, motivoDoErro, nivelDeRms, nivelParaBarra, nomeDoFormato, rmsDeAmostras, suavizarBarra } from "../src/lib/gravador";

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
    travado = false; // o "stop" nunca chega (o que se viu no CI)
    stop() {
      this.state = "inactive";
      if (!this.travado) queueMicrotask(() => this.onstop?.());
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

  it("pede o microfone sem filtros de voz; só com `reduzirRuido` liga a supressão de ruído (I-29)", async () => {
    const pedidos: MediaStreamConstraints[] = [];
    trilha = new Trilha();
    vi.stubGlobal("MediaRecorder", RecorderFalso);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: async (c: MediaStreamConstraints) => {
          pedidos.push(c);
          return { getTracks: () => [trilha] };
        },
      },
    });
    const g = new Gravador();
    expect(await g.iniciar()).toBe("desligado");
    await g.parar();
    expect(await g.iniciar({ filtro: "android" })).toBe("android");
    await g.parar();
    // Um filtro neural sem contexto de 48 kHz (aqui não há AudioContext) não impede de gravar: segue sem filtro e diz isso.
    expect(await g.iniciar({ filtro: "rnnoise" })).toBe("desligado");
    expect(g.gravando).toBe(true);
    await g.parar();
    const audio = (i: number) => pedidos[i]!.audio as MediaTrackConstraints;
    expect(audio(0)).toMatchObject({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 });
    expect(audio(1)).toMatchObject({ echoCancellation: false, noiseSuppression: true, autoGainControl: false, channelCount: 1 });
    expect(audio(2)).toMatchObject({ echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }); // o filtro neural não liga o do aparelho
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

  it("se o MediaRecorder nunca avisa que parou, `parar` entrega o que já foi gravado depois do limite, devolvendo o microfone", async () => {
    vi.useFakeTimers();
    try {
      preparar();
      const g = new Gravador();
      await g.iniciar();
      RecorderFalso.ultimo!.travado = true;
      RecorderFalso.ultimo!.entregar(700);
      let r: Awaited<ReturnType<Gravador["parar"]>> | undefined;
      const espera = g.parar().then((x) => (r = x));
      await vi.advanceTimersByTimeAsync(LIMITE_PARA_PARAR_MS - 100);
      expect(r).toBeUndefined(); // ainda esperando o aviso
      await vi.advanceTimersByTimeAsync(200);
      await espera;
      expect(r?.bytes).toBe(700);
      expect(trilha.parou).toBe(true);
      // os ouvintes do gravador antigo saem: um pedaço que chegasse tarde não pode entrar numa gravação nova
      expect(RecorderFalso.ultimo!.ondataavailable).toBeNull();
      expect(RecorderFalso.ultimo!.onerror).toBeNull();
      if (r) URL.revokeObjectURL(r.url);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no limite, sem nada gravado, `parar` devolve nulo (a tela mostra o erro) em vez de esperar para sempre", async () => {
    vi.useFakeTimers();
    try {
      preparar();
      const g = new Gravador();
      await g.iniciar();
      RecorderFalso.ultimo!.travado = true;
      const espera = g.parar();
      await vi.advanceTimersByTimeAsync(LIMITE_PARA_PARAR_MS + 10);
      expect(await espera).toBeNull();
      expect(trilha.parou).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("quando o aviso chega, não sobra o temporizador do limite", async () => {
    vi.useFakeTimers();
    try {
      preparar();
      const g = new Gravador();
      await g.iniciar();
      RecorderFalso.ultimo!.entregar(300);
      const r = await g.parar();
      expect(r?.bytes).toBe(300);
      expect(vi.getTimerCount()).toBe(0);
      if (r) URL.revokeObjectURL(r.url);
    } finally {
      vi.useRealTimers();
    }
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

describe("medidor de som", () => {
  it("o nível vai de 0 (silêncio) a 1 (fundo de escala), em decibéis", () => {
    expect(nivelDeRms(0)).toBe(0);
    expect(nivelDeRms(1)).toBe(1);
    expect(nivelDeRms(10 ** (PISO_DB / 20))).toBeCloseTo(0, 5); // −60 dBFS: no piso
    expect(nivelDeRms(10 ** (-30 / 20))).toBeCloseTo(0.5, 5); // −30 dBFS: no meio
    expect(nivelDeRms(1e-9)).toBe(0); // abaixo do piso
    expect(nivelDeRms(5)).toBe(1); // acima do fundo de escala
  });
  it("entrada inválida vale 0", () => {
    for (const v of [NaN, -1, Infinity, -Infinity]) expect(nivelDeRms(v), String(v)).toBe(0);
  });
  it("RMS: o valor de uma onda e o de nenhuma amostra", () => {
    expect(rmsDeAmostras([])).toBe(0);
    expect(rmsDeAmostras([0, 0, 0])).toBe(0);
    expect(rmsDeAmostras([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 6);
    const seno = Array.from({ length: 1000 }, (_, i) => Math.sin((2 * Math.PI * i) / 100));
    expect(rmsDeAmostras(seno)).toBeCloseTo(Math.SQRT1_2, 3);
  });
  it("o limiar de som fica acima do chiado e abaixo de uma voz baixa", () => {
    expect(nivelDeRms(10 ** (-55 / 20))).toBeLessThan(LIMIAR_SOM); // chiado de microfone parado
    expect(nivelDeRms(10 ** (-35 / 20))).toBeGreaterThan(LIMIAR_SOM); // voz baixa
  });
});

describe("detector de som", () => {
  it("com som, avisa que há som e nunca que falta", () => {
    const d = new DetectorDeSom();
    d.reiniciar(0);
    expect(d.atualizar(0.6, 100)).toEqual({ comSom: true, semSom: false });
    expect(d.atualizar(0.6, 10000)).toEqual({ comSom: true, semSom: false });
  });
  it("sem som por 3 s, avisa que falta; antes disso, não", () => {
    const d = new DetectorDeSom();
    d.reiniciar(1000);
    expect(d.atualizar(0.01, 2000).semSom).toBe(false);
    expect(d.atualizar(0.01, 1000 + SILENCIO_MS - 1).semSom).toBe(false);
    expect(d.atualizar(0.01, 1000 + SILENCIO_MS).semSom).toBe(true);
  });
  it("quando o som volta, o aviso some e a contagem recomeça", () => {
    const d = new DetectorDeSom();
    d.reiniciar(0);
    expect(d.atualizar(0, 5000).semSom).toBe(true);
    expect(d.atualizar(0.5, 5100)).toEqual({ comSom: true, semSom: false });
    expect(d.atualizar(0, 7000).semSom).toBe(false); // só 1,9 s desde o último som
    expect(d.atualizar(0, 8200).semSom).toBe(true);
  });
  it("reiniciar começa uma gravação nova do zero", () => {
    const d = new DetectorDeSom();
    d.reiniciar(0);
    expect(d.atualizar(0, 9000).semSom).toBe(true);
    d.reiniciar(9000);
    expect(d.atualizar(0, 9500).semSom).toBe(false);
  });
});

describe("medidor do Gravador (com um AudioContext falso)", () => {
  class Trilha extends EventTarget {
    stop() {}
  }
  class RecorderFalso {
    static isTypeSupported = () => true;
    state: "inactive" | "recording" = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
    }
  }
  const criados: ContextoFalso[] = [];
  class ContextoFalso {
    state: "running" | "suspended" = "running";
    resume() {
      return Promise.resolve();
    }
    close() {
      this.fechado = true;
      return Promise.resolve();
    }
    fechado = false;
    createAnalyser() {
      return { fftSize: 0, getFloatTimeDomainData: (a: Float32Array) => a.fill(0.5) };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    constructor() {
      criados.push(this);
    }
  }
  function preparar(globais: Record<string, unknown>) {
    vi.stubGlobal("MediaRecorder", RecorderFalso);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [new Trilha()] }) } });
    for (const [nome, valor] of Object.entries(globais)) vi.stubGlobal(nome, valor);
  }
  afterEach(() => {
    vi.unstubAllGlobals();
    criados.length = 0;
  });

  it("com AudioContext rodando o medidor está ativo e mede o nível", async () => {
    preparar({ AudioContext: ContextoFalso });
    const g = new Gravador();
    await g.iniciar();
    expect(g.medidorAtivo).toBe(true);
    expect(g.nivel()).toBeCloseTo(0.9, 2); // amostras em 0,5 (RMS 0,5): −6 dBFS, (−6 + 60) / 60
    g.soltar();
    expect(g.medidorAtivo).toBe(false);
    expect(criados[0].fechado).toBe(true); // o contexto é devolvido ao aparelho
  });

  it("sem AudioContext o medidor não está ativo (nem se deve avisar \"sem som\")", async () => {
    preparar({});
    const g = new Gravador();
    await g.iniciar();
    expect(g.gravando).toBe(true); // a gravação segue igual
    expect(g.medidorAtivo).toBe(false);
    expect(g.nivel()).toBe(0);
    g.soltar();
  });

  it("com o contexto suspenso (o navegador não deixou o áudio iniciar) o medidor não está ativo", async () => {
    class Suspenso extends ContextoFalso {
      override state = "suspended" as const;
    }
    preparar({ AudioContext: Suspenso });
    const g = new Gravador();
    await g.iniciar();
    expect(g.medidorAtivo).toBe(false);
    g.soltar();
  });

  it("usa o nome com prefixo (webkitAudioContext) quando é o único", async () => {
    preparar({ webkitAudioContext: ContextoFalso });
    const g = new Gravador();
    await g.iniciar();
    expect(g.medidorAtivo).toBe(true);
    g.soltar();
  });
});

describe("barra do medidor", () => {
  const daDb = (db: number) => nivelDeRms(10 ** (db / 20));
  it("usa só a faixa de −50 a −8 dBFS", () => {
    expect(nivelParaBarra(daDb(-55))).toBe(0);
    expect(nivelParaBarra(daDb(-50))).toBeCloseTo(0, 5);
    expect(nivelParaBarra(daDb(-29))).toBeCloseTo(0.5, 5);
    expect(nivelParaBarra(daDb(-8))).toBeCloseTo(1, 5);
    expect(nivelParaBarra(1)).toBe(1);
    expect(nivelParaBarra(NaN)).toBe(0);
    expect(nivelParaBarra(daDb(-50 + 42 * 0.25))).toBeCloseTo(0.1464, 3); // cosseno: o quarto da faixa mostra menos de um quarto
    expect(nivelParaBarra(daDb(-50 + 42 * 0.75))).toBeCloseTo(0.8536, 3);
  });
  it("sobe rápido e cai devagar", () => {
    expect(suavizarBarra(0, 1)).toBeCloseTo(0.6, 5);
    expect(suavizarBarra(0.5, 0.5)).toBe(0.5);
    expect(suavizarBarra(1, 0)).toBeCloseTo(QUEDA_DA_BARRA, 5);
    let v = 1;
    for (let i = 0; i < 5; i++) v = suavizarBarra(v, 0); // 0,4 s de silêncio
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.6);
    expect(suavizarBarra(0.1, 0.09)).toBeGreaterThanOrEqual(0.09); // nunca abaixo do nível atual
  });
});
