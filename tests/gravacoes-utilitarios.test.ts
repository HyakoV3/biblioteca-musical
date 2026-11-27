import { describe, expect, it, vi } from "vitest";
import { LimiteEstourado, comLimite, formatarData } from "../src/lib/gravacoes";

describe("data da gravação", () => {
  it("dia e mês, hora e minuto, no formato do idioma", () => {
    const quando = new Date(2026, 10, 17, 10, 46).getTime();
    expect(formatarData(quando, "pt")).toMatch(/17\/11.*10:46/);
    expect(formatarData(quando, "en")).toMatch(/11\/17.*10:46/);
  });
  it("valor inválido vira texto vazio", () => {
    expect(formatarData(NaN, "pt")).toBe("");
  });
});

describe("comLimite (a escrita que nunca confirma não prende a tela)", () => {
  it("devolve o resultado se a promessa termina antes do limite, sem deixar o temporizador", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(Promise.resolve(42), 1000, "demorou");
      await expect(p).resolves.toBe(42);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejeita com o motivo se a promessa nunca termina", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(new Promise<number>(() => {}), 1000, "o armazenamento demorou");
      const resultado = expect(p).rejects.toThrow("o armazenamento demorou");
      await vi.advanceTimersByTimeAsync(1001);
      await resultado;
    } finally {
      vi.useRealTimers();
    }
  });

  it("mantém o erro da própria promessa, antes do limite", async () => {
    vi.useFakeTimers();
    try {
      await expect(comLimite(Promise.reject(new Error("cota cheia")), 1000, "demorou")).rejects.toThrow("cota cheia");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("LimiteEstourado", () => {
  it("comLimite estoura com o erro próprio, com a mensagem pedida", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(new Promise<number>(() => {}), 1000, "demorou");
      const visto = expect(p).rejects.toBeInstanceOf(LimiteEstourado);
      await vi.advanceTimersByTimeAsync(1000);
      await visto;
      await expect(comLimite(Promise.reject(new Error("cota cheia")), 1000, "demorou")).rejects.not.toBeInstanceOf(LimiteEstourado);
    } finally {
      vi.useRealTimers();
    }
  });
});
