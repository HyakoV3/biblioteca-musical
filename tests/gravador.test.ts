import { describe, expect, it } from "vitest";
import { FORMATOS_PREFERIDOS, escolherFormato, formatarTamanho, formatarTempo, motivoDoErro, nomeDoFormato } from "../src/lib/gravador";

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
});
