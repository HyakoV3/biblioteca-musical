import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_SAIDA_AUDIO, aoMedir, chaveAtual, criarContexto, lerModo, lerModos, opcoesDoModo, rotaAtual, salvarModo, ultimaMedida } from "../src/lib/saidaAudio";

let opcoesRecebidas: unknown[] = [];
class FakeCtx {
  sampleRate = 48000;
  baseLatency = 0.021;
  outputLatency = 0.0403;
  constructor(opcoes?: unknown) {
    opcoesRecebidas.push(opcoes);
  }
}

const ponte = (rota: unknown) => vi.stubGlobal("BmServico", { rotaDeSaida: () => rota });

const guardado = new Map<string, string>();
beforeEach(() => {
  opcoesRecebidas = [];
  guardado.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
  });
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => vi.unstubAllGlobals());

describe("rota de saída", () => {
  it("lê a rota da ponte do Android", () => {
    for (const r of ["usb", "fio", "bluetooth", "alto-falante"]) {
      ponte(r);
      expect(rotaAtual()).toBe(r);
    }
  });
  it("sem a ponte (computador, APK antigo) ou com um valor que não conhece, é o alto-falante", () => {
    expect(rotaAtual()).toBe("alto-falante");
    ponte("satelite");
    expect(rotaAtual()).toBe("alto-falante");
    vi.stubGlobal("BmServico", { rotaDeSaida: () => { throw new Error("x"); } });
    expect(rotaAtual()).toBe("alto-falante");
  });
});

describe("modo de áudio por rota", () => {
  it("o padrão é o automático, e cada rota guarda o seu modo", () => {
    expect(lerModo("usb")).toBe("automatico");
    salvarModo("usb", "atraso");
    salvarModo("bluetooth", "estavel");
    expect(lerModo("usb")).toBe("atraso");
    expect(lerModo("bluetooth")).toBe("estavel");
    expect(lerModo("alto-falante")).toBe("automatico");
  });
  it("voltar ao automático apaga a escolha guardada", () => {
    salvarModo("usb", "estavel");
    salvarModo("usb", "automatico");
    expect(guardado.get(CHAVE_SAIDA_AUDIO)).toBe("{}");
  });
  it("valida ao ler: o que não conhece é ignorado, e o JSON quebrado não derruba", () => {
    guardado.set(CHAVE_SAIDA_AUDIO, JSON.stringify({ usb: "turbo", fio: "estavel", lua: "atraso" }));
    expect(lerModos()).toEqual({ fio: "estavel" });
    guardado.set(CHAVE_SAIDA_AUDIO, "{quebrado");
    expect(lerModos()).toEqual({});
  });
  it("cada modo pede o seu latencyHint (o automático não pede nada)", () => {
    expect(opcoesDoModo("automatico")).toEqual({});
    expect(opcoesDoModo("estavel")).toEqual({ latencyHint: "playback" });
    expect(opcoesDoModo("medio")).toEqual({ latencyHint: "balanced" });
    expect(opcoesDoModo("atraso")).toEqual({ latencyHint: "interactive" });
  });
  it("a chave junta rota e modo, e muda quando um dos dois muda", () => {
    ponte("usb");
    expect(chaveAtual()).toBe("usb:automatico");
    salvarModo("usb", "estavel");
    expect(chaveAtual()).toBe("usb:estavel");
    ponte("fio");
    expect(chaveAtual()).toBe("fio:automatico");
  });
});

describe("criarContexto", () => {
  it("cria o contexto com as opções da rota e do modo de agora, e guarda as medidas em milissegundos", () => {
    ponte("usb");
    salvarModo("usb", "estavel");
    const avisos = vi.fn();
    const cancelar = aoMedir(avisos);
    criarContexto();
    expect(opcoesRecebidas).toEqual([{ latencyHint: "playback" }]);
    expect(ultimaMedida()).toEqual({ rota: "usb", modo: "estavel", taxa: 48000, base: 21, saida: 40 });
    expect(avisos).toHaveBeenCalledTimes(1);
    cancelar();
    criarContexto();
    expect(avisos).toHaveBeenCalledTimes(1);
  });
  it("um ouvinte que falha não impede o contexto de ser devolvido, e os outros ouvintes ainda são avisados", () => {
    ponte("usb");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bom = vi.fn();
    const c1 = aoMedir(() => {
      throw new Error("ouvinte quebrado");
    });
    const c2 = aoMedir(bom);
    let ctx: unknown;
    expect(() => (ctx = criarContexto())).not.toThrow();
    expect(ctx).toBeInstanceOf(FakeCtx);
    expect(bom).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalled();
    c1();
    c2();
    aviso.mockRestore();
  });
  it("o aparelho que não informa outputLatency fica com `saida` nulo", () => {
    vi.stubGlobal("AudioContext", class { sampleRate = 44100; baseLatency = 0.01; });
    ponte("fio");
    criarContexto();
    expect(ultimaMedida()).toMatchObject({ rota: "fio", taxa: 44100, base: 10, saida: null });
  });
  it("se o navegador recusar as opções, cai no contexto padrão e o som toca", () => {
    let chamadas = 0;
    vi.stubGlobal("AudioContext", class { sampleRate = 48000; constructor(o?: unknown) { chamadas++; if (o && Object.keys(o as object).length) throw new TypeError("opção inválida"); } });
    ponte("usb");
    salvarModo("usb", "atraso");
    expect(() => criarContexto()).not.toThrow();
    expect(chamadas).toBe(2);
  });
});
