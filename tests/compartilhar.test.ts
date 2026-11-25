import { afterEach, describe, expect, it, vi } from "vitest";
import { OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";
import { BYTES_POR_PEDACO, compartilharGravacao, nomeDoArquivo, podeCompartilhar, tipoSemCodec } from "../src/lib/compartilhar";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).BmCompartilhar;
  vi.restoreAllMocks();
  vi.unstubAllGlobals(); // devolve o localStorage de verdade (ou a falta dele), mesmo que um teste falhe no meio
});

describe("nomes e tipos", () => {
  it("tira o codec do tipo", () => {
    expect(tipoSemCodec("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(tipoSemCodec("")).toBe("audio/*");
  });
  it("nome do arquivo com data e extensão do formato", () => {
    const t = new Date(2026, 10, 7, 9, 5).getTime();
    expect(nomeDoArquivo(t, "audio/webm;codecs=opus")).toBe("gravacao-2026-11-07-0905.webm");
    expect(nomeDoArquivo(t, "audio/mp4")).toBe("gravacao-2026-11-07-0905.m4a");
    expect(nomeDoArquivo(t, "audio/ogg;codecs=opus")).toBe("gravacao-2026-11-07-0905.ogg");
  });
});

describe("ponte do Android", () => {
  function ponteFalsa(sobrescrever: Record<string, unknown> = {}) {
    const partes: string[] = [];
    const p = {
      comecar: vi.fn(() => true),
      parte: vi.fn((b: string) => (partes.push(b), true)),
      enviar: vi.fn(() => true),
      cancelar: vi.fn(),
      ...sobrescrever,
    };
    (globalThis as Record<string, unknown>).BmCompartilhar = p;
    return { p, partes };
  }

  it("WebM/Opus vai como Ogg/Opus (.ogg, tipo com codec); WebM que não se entende segue como está", async () => {
    const { p, partes } = ponteFalsa();
    const webm = bytesDe(OPUS_WEBM_AO_VIVO);
    expect(await compartilharGravacao(new Blob([webm], { type: "audio/webm;codecs=opus" }), "g.webm", "Enviar")).toBe("ok");
    expect(p.comecar).toHaveBeenLastCalledWith("g.ogg", "audio/ogg");
    expect(atob(partes.join("")).startsWith("OggS")).toBe(true);
    partes.length = 0;
    expect(await compartilharGravacao(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "h.weba", "Enviar")).toBe("ok");
    expect(p.comecar).toHaveBeenLastCalledWith("h.weba", "audio/webm");
  });

  it("com texto usa enviarComTexto; sem texto (ou ponte antiga) usa enviar", async () => {
    const enviarComTexto = vi.fn((_titulo: string, _texto: string) => true);
    const { p } = ponteFalsa({ enviarComTexto });
    const audio = () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    expect(await compartilharGravacao(audio(), "a.webm", "Enviar", "*Contexto*")).toBe("ok");
    expect(enviarComTexto).toHaveBeenCalledWith("Enviar", "*Contexto*");
    expect(p.enviar).not.toHaveBeenCalled();
    expect(await compartilharGravacao(audio(), "a.webm", "Enviar")).toBe("ok");
    expect(p.enviar).toHaveBeenCalledWith("Enviar");
    const antiga = ponteFalsa();
    expect(await compartilharGravacao(audio(), "a.webm", "Enviar", "*Contexto*")).toBe("ok");
    expect(antiga.p.enviar).toHaveBeenCalledWith("Enviar");
  });

  it("só aparece quando há ponte ou Web Share", () => {
    expect(podeCompartilhar()).toBe(false);
    ponteFalsa();
    expect(podeCompartilhar()).toBe(true);
  });

  it("entrega o áudio em pedaços íntegros e abre a folha", async () => {
    const { p, partes } = ponteFalsa();
    const bytes = new Uint8Array(BYTES_POR_PEDACO * 2 + 10).map((_, i) => i % 251);
    const r = await compartilharGravacao(new Blob([bytes], { type: "audio/webm;codecs=opus" }), "a.webm", "Enviar");
    expect(r).toBe("ok");
    expect(p.comecar).toHaveBeenCalledWith("a.webm", "audio/webm");
    expect(partes).toHaveLength(3);
    const juntos = partes.map((b) => atob(b)).join("");
    expect(juntos).toHaveLength(bytes.length);
    expect(Array.from(juntos, (c) => c.charCodeAt(0))).toEqual(Array.from(bytes));
    expect(p.enviar).toHaveBeenCalledWith("Enviar");
  });

  it("erro se a ponte não cria o arquivo, falha num pedaço ou não abre a folha", async () => {
    ponteFalsa({ comecar: () => false });
    expect(await compartilharGravacao(new Blob(["x"]), "a", "t")).toBe("erro");
    const { p } = ponteFalsa({ parte: () => false });
    expect(await compartilharGravacao(new Blob(["x"]), "a", "t")).toBe("erro");
    expect(p.enviar).not.toHaveBeenCalled();
    ponteFalsa({ enviar: () => false });
    expect(await compartilharGravacao(new Blob(["x"]), "a", "t")).toBe("erro");
  });

  it("cancela na ponte quando falha depois de começar", async () => {
    const { p } = ponteFalsa({ parte: () => false });
    expect(await compartilharGravacao(new Blob(["x"]), "a", "t")).toBe("erro");
    expect(p.cancelar).toHaveBeenCalledTimes(1);
    const b = ponteFalsa();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const quebrado = { size: 5, type: "audio/webm", slice: () => ({ arrayBuffer: () => Promise.reject(new Error("leitura")) }) } as unknown as Blob;
    expect(await compartilharGravacao(quebrado, "a", "t")).toBe("erro");
    expect(b.p.cancelar).toHaveBeenCalledTimes(1);
    expect(b.p.enviar).not.toHaveBeenCalled();
  });

  it("envia um de cada vez, sem misturar os arquivos", async () => {
    const eventos: string[] = [];
    ponteFalsa({
      comecar: (n: string) => (eventos.push(`começa ${n}`), true),
      parte: () => (eventos.push("parte"), true),
      enviar: () => (eventos.push("envia"), true),
    });
    const a = new Blob([new Uint8Array(BYTES_POR_PEDACO * 2)]);
    await Promise.all([compartilharGravacao(a, "um", "t"), compartilharGravacao(new Blob(["x"]), "dois", "t")]);
    expect(eventos).toEqual(["começa um", "parte", "parte", "envia", "começa dois", "parte", "envia"]);
  });

  it("uma exceção da ponte vira erro, não derruba", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ponteFalsa({ comecar: () => { throw new Error("x"); } });
    expect(await compartilharGravacao(new Blob(["x"]), "a", "t")).toBe("erro");
  });
});

describe("limpeza da escolha antiga (.webm | .weba)", () => {
  it("apaga a chave que o interruptor guardava e ignora falha de armazenamento", async () => {
    const { limparEscolhaAntigaDoFormato } = await import("../src/lib/preferencias");
    const m = new Map<string, string>([["prefs.compartilhar", '{"webm":"weba"}'], ["outra", "1"]]);
    vi.stubGlobal("localStorage", { removeItem: (k: string) => void m.delete(k) });
    limparEscolhaAntigaDoFormato();
    expect([...m.keys()]).toEqual(["outra"]);
    vi.stubGlobal("localStorage", undefined);
    expect(() => limparEscolhaAntigaDoFormato()).not.toThrow();
  });
});
