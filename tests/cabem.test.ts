import { afterEach, describe, expect, it, vi } from "vitest";
import { quantosCabem } from "../src/lib/cabem";
import { CHAVE_AFINADOR, RECENTES_MAX, adicionarNota, lerAfinador, normalizarPref, salvarAfinador } from "../src/lib/afinadorPrefs";

afterEach(() => vi.unstubAllGlobals());

describe("quantos itens cabem na tela", () => {
  it("arredonda para baixo: nunca mostra um item cortado, e pode sobrar espaço", () => {
    // itens de 48 px com vão de 8: 1 item = 48, 2 = 104, 3 = 160, 4 = 216
    expect(quantosCabem(215, 48, 8, 10)).toBe(3);
    expect(quantosCabem(216, 48, 8, 10)).toBe(4);
    expect(quantosCabem(300, 48, 8, 10)).toBe(5);
  });
  it("nunca mais do que existe, e ao menos 1 quando há itens (mesmo sem espaço)", () => {
    expect(quantosCabem(10000, 48, 8, 3)).toBe(3);
    expect(quantosCabem(5, 48, 8, 10)).toBe(1);
    expect(quantosCabem(-50, 48, 8, 10)).toBe(1);
    expect(quantosCabem(500, 48, 8, 0)).toBe(0);
  });
  it("sem medida válida mostra tudo (não esconde por um erro de medição)", () => {
    expect(quantosCabem(500, 0, 8, 4)).toBe(4);
    expect(quantosCabem(NaN, 48, 8, 4)).toBe(4);
  });
});

describe("o que o afinador lembra", () => {
  it("a nota nova vai para o topo, sem repetir, com no máximo 10", () => {
    let l = adicionarNota([], { classe: 0, oitava: 4 });
    l = adicionarNota(l, { classe: 7, oitava: 3 });
    l = adicionarNota(l, { classe: 0, oitava: 4 });
    expect(l).toEqual([{ classe: 0, oitava: 4 }, { classe: 7, oitava: 3 }]);
    for (let i = 0; i < 12; i++) l = adicionarNota(l, { classe: i % 12, oitava: 5 });
    expect(l).toHaveLength(RECENTES_MAX);
    expect(l[0]).toEqual({ classe: 11, oitava: 5 });
  });
  it("valores inválidos são descartados ao ler, mantendo a ordem salva", () => {
    expect(normalizarPref(null).recentes).toEqual([]);
    expect(normalizarPref({ recentes: "x" }).recentes).toEqual([]);
    const p = normalizarPref({ recentes: [{ classe: 2, oitava: 4 }, { classe: 12, oitava: 4 }, { classe: 2.5, oitava: 4 }, { classe: 1, oitava: 99 }, { classe: 2, oitava: 4 }, { classe: 5, oitava: 3 }, "lixo", null] });
    expect(p.recentes).toEqual([{ classe: 2, oitava: 4 }, { classe: 5, oitava: 3 }]);
  });
  it("guarda e lê do aparelho, e ignora falha de armazenamento", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    salvarAfinador({ recentes: [{ classe: 9, oitava: 4 }], limite: 0 });
    expect(JSON.parse(m.get(CHAVE_AFINADOR)!)).toEqual({ recentes: [{ classe: 9, oitava: 4 }], limite: 0 });
    expect(lerAfinador().recentes).toEqual([{ classe: 9, oitava: 4 }]);
    vi.stubGlobal("localStorage", undefined);
    expect(lerAfinador().recentes).toEqual([]);
    expect(() => salvarAfinador({ recentes: [], limite: 0 })).not.toThrow();
  });
});

describe("o afinador lembra o tempo do temporizador", () => {
  it("só aceita até parar, 10, 20 ou 30 s; o resto volta a até parar", () => {
    for (const l of [0, 10, 20, 30]) expect(normalizarPref({ recentes: [], limite: l }).limite).toBe(l);
    for (const ruim of [5, 15, -1, "20", null, NaN, undefined, 99]) expect(normalizarPref({ recentes: [], limite: ruim }).limite).toBe(0);
    expect(normalizarPref(null).limite).toBe(0);
    expect(normalizarPref([20]).limite).toBe(0);
  });
  it("salvar e ler devolve o tempo escolhido, e escolher o tempo não perde as notas recentes", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    salvarAfinador({ recentes: [{ classe: 9, oitava: 4 }], limite: 20 });
    expect(lerAfinador()).toEqual({ recentes: [{ classe: 9, oitava: 4 }], limite: 20 });
  });
  it("preferência antiga, sem o tempo, abre em até parar", () => {
    const m = new Map<string, string>([[CHAVE_AFINADOR, JSON.stringify({ recentes: [{ classe: 2, oitava: 4 }] })]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    expect(lerAfinador()).toEqual({ recentes: [{ classe: 2, oitava: 4 }], limite: 0 });
  });
});
