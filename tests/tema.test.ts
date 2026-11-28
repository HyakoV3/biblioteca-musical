import { afterEach, describe, expect, it, vi } from "vitest";

// Caracteriza tema.svelte.ts com document e localStorage falsos: leitura inicial, aplicação no <html> e gravação.
function ambiente(salvo: Record<string, string> = {}, quebrado = false) {
  const guardado = { ...salvo };
  const dataset: Record<string, string> = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => {
      if (quebrado) throw new Error("sem armazenamento");
      return guardado[k] ?? null;
    },
    setItem: (k: string, v: string) => {
      if (quebrado) throw new Error("sem armazenamento");
      guardado[k] = v;
    },
  });
  return { guardado, dataset };
}

async function carregar() {
  vi.resetModules();
  return await import("../src/lib/tema.svelte");
}

afterEach(() => vi.unstubAllGlobals());

describe("tema.svelte", () => {
  it("lê o tema e o estilo salvos; valor inválido ou ausente cai no padrão", async () => {
    ambiente({ tema: "escuro", estilo: "marinho" });
    let m = await carregar();
    expect([m.tema.atual, m.estilo.atual]).toEqual(["escuro", "marinho"]);
    ambiente({ tema: "roxo", estilo: "sepia" });
    m = await carregar();
    expect([m.tema.atual, m.estilo.atual]).toEqual(["sistema", "normal"]);
    ambiente();
    m = await carregar();
    expect([m.tema.atual, m.estilo.atual]).toEqual(["sistema", "normal"]);
  });

  it("sem armazenamento usa o padrão e não quebra ao gravar", async () => {
    ambiente({}, true);
    const m = await carregar();
    expect([m.tema.atual, m.estilo.atual]).toEqual(["sistema", "normal"]);
    m.tema.atual = "claro";
    m.estilo.atual = "pergaminho";
    expect([m.tema.atual, m.estilo.atual]).toEqual(["claro", "pergaminho"]);
  });

  it("grava a escolha", async () => {
    const { guardado } = ambiente();
    const m = await carregar();
    m.tema.atual = "alto-contraste";
    m.estilo.atual = "pergaminho";
    expect(guardado).toMatchObject({ tema: "alto-contraste", estilo: "pergaminho" });
  });

  it("aplica atributos no <html>; sistema e normal removem o atributo", async () => {
    const { dataset } = ambiente();
    const m = await carregar();
    m.aplicarTema("escuro");
    m.aplicarEstilo("marinho");
    expect(dataset).toEqual({ tema: "escuro", estilo: "marinho" });
    m.aplicarTema("sistema");
    m.aplicarEstilo("normal");
    expect(dataset).toEqual({});
  });
});
