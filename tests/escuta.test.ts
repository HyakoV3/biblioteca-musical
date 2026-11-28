import { afterEach, describe, expect, it, vi } from "vitest";
import { Escuta } from "../src/lib/escuta";

type Registro = string[];

/** Monta um microfone e um áudio falsos que anotam, em ordem, o que a Escuta faz com eles. */
function montar(opcoes: { negar?: boolean; adiarPermissao?: boolean; analisadorFalha?: boolean } = {}) {
  const log: Registro = [];
  const ouvintes: Record<string, () => void> = {};
  const faixa = {
    stop: () => log.push("faixa.stop"),
    addEventListener: (nome: string, f: () => void, o: unknown) => {
      log.push(`faixa.on(${nome},${JSON.stringify(o)})`);
      ouvintes[nome] = f;
    },
  };
  const fluxo = { getTracks: () => [faixa], getAudioTracks: () => [faixa] };
  let liberar: () => void = () => {};
  const getUserMedia = vi.fn(async (c: unknown) => {
    log.push(`getUserMedia(${JSON.stringify(c)})`);
    if (opcoes.adiarPermissao) await new Promise<void>((r) => (liberar = r));
    if (opcoes.negar) throw new DOMException("negado", "NotAllowedError");
    return fluxo;
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  class Contexto {
    sampleRate = 48000;
    constructor() {
      log.push("contexto.novo");
    }
    close() {
      log.push("contexto.close");
      return Promise.resolve();
    }
    resume() {
      log.push("contexto.resume");
      return Promise.resolve();
    }
    createAnalyser() {
      log.push("createAnalyser");
      if (opcoes.analisadorFalha) throw new Error("sem analisador");
      return {
        fftSize: 0,
        getFloatTimeDomainData: (a: Float32Array) => {
          log.push(`ler(${a.length})`);
        },
      };
    }
    createMediaStreamSource() {
      log.push("createMediaStreamSource");
      return { connect: () => log.push("connect") };
    }
  }
  vi.stubGlobal("AudioContext", Contexto);
  return { log, ouvintes, getUserMedia, liberar: () => liberar() };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Escuta (captura do microfone)", () => {
  it("liga: abre o microfone sem filtros, monta o áudio na ordem e lê a cada 50 ms", async () => {
    vi.useFakeTimers();
    const m = montar();
    const e = new Escuta();
    const leituras: unknown[] = [];
    await e.iniciar((b) => leituras.push(b));
    expect(e.ligada).toBe(true);
    expect(m.log).toEqual([
      "contexto.novo",
      'getUserMedia({"audio":{"echoCancellation":false,"noiseSuppression":false,"autoGainControl":false,"channelCount":1}})',
      'faixa.on(ended,{"once":true})',
      "contexto.resume",
      "createAnalyser",
      "createMediaStreamSource",
      "connect",
    ]);
    vi.advanceTimersByTime(150);
    expect(leituras).toHaveLength(3);
    expect(m.log.filter((l) => l.startsWith("ler("))).toHaveLength(3);
    e.parar();
    expect(e.ligada).toBe(false);
    vi.advanceTimersByTime(200);
    expect(leituras).toHaveLength(3);
    expect(m.log.slice(-2)).toEqual(["faixa.stop", "contexto.close"]);
  });

  it("segunda chamada com a escuta ligada não faz nada", async () => {
    vi.useFakeTimers();
    const m = montar();
    const e = new Escuta();
    await e.iniciar(() => {});
    await e.iniciar(() => {});
    expect(m.getUserMedia).toHaveBeenCalledTimes(1);
    e.parar();
  });

  it("sem microfone ou sem áudio: rejeita com NotSupportedError", async () => {
    vi.stubGlobal("navigator", {});
    await expect(new Escuta().iniciar(() => {})).rejects.toMatchObject({ name: "NotSupportedError", message: "sem microfone" });
    montar();
    vi.stubGlobal("AudioContext", undefined);
    await expect(new Escuta().iniciar(() => {})).rejects.toMatchObject({ name: "NotSupportedError", message: "sem áudio" });
  });

  it("permissão negada: fecha o contexto criado e repassa o erro", async () => {
    const m = montar({ negar: true });
    const e = new Escuta();
    await expect(e.iniciar(() => {})).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(m.log).toContain("contexto.close");
    expect(e.ligada).toBe(false);
  });

  it("parar() enquanto a permissão era pedida: solta tudo e não liga", async () => {
    const m = montar({ adiarPermissao: true });
    const e = new Escuta();
    const p = e.iniciar(() => {});
    await Promise.resolve();
    e.parar();
    m.liberar();
    await p;
    expect(e.ligada).toBe(false);
    expect(m.log.slice(-2)).toEqual(["faixa.stop", "contexto.close"]);
    expect(m.log).not.toContain("createAnalyser");
  });

  it("o sistema tirar o microfone para a escuta e avisa uma vez; depois de parar, o aviso não vale", async () => {
    vi.useFakeTimers();
    const m = montar();
    const e = new Escuta();
    const aoPerder = vi.fn();
    await e.iniciar(() => {}, aoPerder);
    m.ouvintes.ended();
    expect(aoPerder).toHaveBeenCalledTimes(1);
    expect(e.ligada).toBe(false);

    const m2 = montar();
    const e2 = new Escuta();
    const aoPerder2 = vi.fn();
    await e2.iniciar(() => {}, aoPerder2);
    e2.parar();
    m2.ouvintes.ended();
    expect(aoPerder2).not.toHaveBeenCalled();
  });

  it("se montar a leitura falha, solta o microfone e fecha o áudio, relança o mesmo erro e permite iniciar de novo", async () => {
    const m = montar({ analisadorFalha: true });
    const e = new Escuta();
    await expect(e.iniciar(() => {})).rejects.toThrow("sem analisador");
    expect(m.log).toContain("faixa.stop");
    expect(m.log).toContain("contexto.close");
    expect(e.ligada).toBe(false);
  });
});
