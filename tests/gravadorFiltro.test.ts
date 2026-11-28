import { afterEach, describe, expect, it, vi } from "vitest";
import { Gravador } from "../src/lib/gravador";

const criarFiltro = vi.fn();
vi.mock("../src/lib/ruido", () => ({ criarFiltro: (...a: unknown[]) => criarFiltro(...a) }));

// Caracterização do caminho do filtro neural no Gravador (fonte → filtro → destino), com tudo falso.
class Trilha extends EventTarget {
  stop() {}
}
const streamDoDestino = { getTracks: () => [] as Trilha[], id: "destino" };
const recorders: { entrada: unknown }[] = [];
class RecorderFalso {
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable = null;
  onstop = null;
  onerror = null;
  constructor(entrada: unknown) {
    recorders.push({ entrada });
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
  }
}
type No = { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
const novoNo = (): No => ({ connect: vi.fn(), disconnect: vi.fn(), destroy: vi.fn() });

let ctxAtual: ContextoFalso;
let fonte: No;
class ContextoFalso {
  sampleRate = 48000;
  state: "running" | "suspended" = "running";
  onstatechange: (() => void) | null = null;
  fechado = false;
  resume = vi.fn(() => Promise.resolve());
  close() {
    this.fechado = true;
    return Promise.resolve();
  }
  createAnalyser() {
    return { fftSize: 0, getFloatTimeDomainData() {} };
  }
  createMediaStreamSource() {
    return fonte;
  }
  createMediaStreamDestination() {
    return { stream: streamDoDestino };
  }
  constructor() {
    ctxAtual = this;
  }
}

function preparar(taxa = 48000) {
  fonte = novoNo();
  vi.stubGlobal("MediaRecorder", RecorderFalso);
  vi.stubGlobal(
    "AudioContext",
    class extends ContextoFalso {
      constructor() {
        super();
        this.sampleRate = taxa;
      }
    },
  );
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [new Trilha()] }) } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  criarFiltro.mockReset();
  recorders.length = 0;
});

describe("Gravador com filtro neural", () => {
  it("liga fonte → filtro → destino, grava a saída do destino e desfaz tudo ao soltar", async () => {
    preparar();
    const filtro = novoNo();
    criarFiltro.mockResolvedValue(filtro);
    const g = new Gravador();
    expect(await g.iniciar({ filtro: "gtcrn" })).toBe("gtcrn");
    expect(criarFiltro).toHaveBeenCalledWith(ctxAtual, "gtcrn");
    expect(fonte.connect).toHaveBeenCalledWith(filtro);
    expect(filtro.connect).toHaveBeenCalledTimes(2); // ao destino e ao analisador do medidor
    expect(recorders[0]!.entrada).toBe(streamDoDestino);
    expect(g.medidorAtivo).toBe(true);
    g.soltar();
    expect(fonte.disconnect).toHaveBeenCalled();
    expect(filtro.disconnect).toHaveBeenCalled();
    expect(filtro.destroy).toHaveBeenCalledOnce();
    expect(ctxAtual.fechado).toBe(true);
  });

  it("contexto que não é de 48 kHz: grava sem filtro, nem tenta carregá-lo", async () => {
    preparar(44100);
    const g = new Gravador();
    expect(await g.iniciar({ filtro: "rnnoise" })).toBe("desligado");
    expect(criarFiltro).not.toHaveBeenCalled();
    expect(g.gravando).toBe(true);
    g.soltar();
  });

  it("filtro que não carrega: grava o microfone direto", async () => {
    preparar();
    criarFiltro.mockRejectedValue(new Error("sem worklet"));
    const g = new Gravador();
    expect(await g.iniciar({ filtro: "rnnoise" })).toBe("desligado");
    expect(g.gravando).toBe(true);
    expect(recorders[0]!.entrada).not.toBe(streamDoDestino);
    expect(g.medidorAtivo).toBe(true);
    g.soltar();
  });

  it("contexto que não roda em 1,5 s: descarta o filtro e grava direto", async () => {
    vi.useFakeTimers();
    preparar();
    const filtro = novoNo();
    criarFiltro.mockImplementation(async (c: ContextoFalso) => {
      c.state = "suspended";
      c.resume.mockImplementation(() => new Promise(() => {}));
      return filtro;
    });
    const g = new Gravador();
    const p = g.iniciar({ filtro: "rnnoise" });
    await vi.advanceTimersByTimeAsync(1600);
    expect(await p).toBe("desligado");
    expect(filtro.destroy).toHaveBeenCalledOnce();
    expect(fonte.connect).not.toHaveBeenCalledWith(filtro);
    g.soltar();
  });

  it("soltar enquanto o filtro carrega cancela a gravação e destrói o filtro", async () => {
    preparar();
    const filtro = novoNo();
    let liberar!: () => void;
    criarFiltro.mockImplementation(() => new Promise((ok) => (liberar = () => ok(filtro))));
    const g = new Gravador();
    const p = g.iniciar({ filtro: "gtcrn" });
    await vi.waitFor(() => expect(criarFiltro).toHaveBeenCalled());
    g.soltar();
    liberar();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(filtro.destroy).toHaveBeenCalledOnce();
    expect(g.gravando).toBe(false);
  });

  it("se o contexto de áudio para durante a gravação com filtro, avisa que foi interrompida", async () => {
    preparar();
    criarFiltro.mockResolvedValue(novoNo());
    const g = new Gravador();
    const aviso = vi.fn();
    g.aoInterromper = aviso;
    await g.iniciar({ filtro: "rnnoise" });
    ctxAtual.state = "suspended";
    ctxAtual.onstatechange?.();
    expect(aviso).toHaveBeenCalledOnce();
    g.soltar();
  });
});
