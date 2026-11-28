import { afterEach, describe, expect, it, vi } from "vitest";
import { foraDaVistaVertical } from "../src/lib/partituraDestaque";

type Tela = { cabecalhoBase: number | null; miniplayer: string; navegacao: string; altura: number };

const cabecalho = (base: number | null) => (base === null ? null : { getBoundingClientRect: () => ({ bottom: base }) });

// Ambiente "node": o DOM é simulado só no que a função lê (cabeçalho, variáveis CSS e altura da janela).
function ambiente(tela: Tela) {
  const css = { "--altura-miniplayer": tela.miniplayer, "--altura-navegacao": tela.navegacao };
  vi.stubGlobal("document", { querySelector: () => cabecalho(tela.cabecalhoBase), documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (n: keyof typeof css) => css[n] }));
  vi.stubGlobal("window", { innerHeight: tela.altura });
}

afterEach(() => vi.unstubAllGlobals());

describe("foraDaVistaVertical", () => {
  const comBarras: Tela = { cabecalhoBase: 50, miniplayer: "60", navegacao: "40", altura: 800 }; // faixa útil: 58 a 692

  it("dentro da faixa entre o cabeçalho e as barras de baixo (com 8 de folga) não está fora", () => {
    ambiente(comBarras);
    expect(foraDaVistaVertical({ top: 58, bottom: 692 })).toBe(false);
    expect(foraDaVistaVertical({ top: 100, bottom: 200 })).toBe(false);
  });

  it("passando do topo ou da base, está fora", () => {
    ambiente(comBarras);
    expect(foraDaVistaVertical({ top: 57, bottom: 100 })).toBe(true);
    expect(foraDaVistaVertical({ top: 100, bottom: 693 })).toBe(true);
  });

  it("sem cabeçalho e sem variáveis CSS, só a folga de 8 conta", () => {
    ambiente({ cabecalhoBase: null, miniplayer: "", navegacao: "", altura: 500 });
    expect(foraDaVistaVertical({ top: 8, bottom: 492 })).toBe(false);
    expect(foraDaVistaVertical({ top: 7, bottom: 100 })).toBe(true);
    expect(foraDaVistaVertical({ top: 10, bottom: 493 })).toBe(true);
  });
});
