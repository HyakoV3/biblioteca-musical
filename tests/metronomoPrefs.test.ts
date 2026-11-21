import { beforeEach, describe, expect, it } from "vitest";
import { CHAVE_METRONOMO, RECENTES_MAX, adicionarRecente, lerMetronomo, normalizarPref, prefPadrao, salvarMetronomo } from "../src/lib/metronomoPrefs";

function armazenamento() {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
  return m;
}

describe("preferências do metrônomo", () => {
  beforeEach(() => void armazenamento());

  it("sem nada guardado, devolve o padrão", () => {
    expect(lerMetronomo()).toEqual(prefPadrao());
  });

  it("guarda e lê de volta", () => {
    salvarMetronomo({ bpm: 90, compasso: 3, recentes: [{ bpm: 90, compasso: 3 }, { bpm: 120, compasso: 4 }] });
    expect(lerMetronomo()).toEqual({ bpm: 90, compasso: 3, recentes: [{ bpm: 90, compasso: 3 }, { bpm: 120, compasso: 4 }] });
  });

  it("valida na leitura: andamento limitado, compasso inválido volta ao padrão, itens ruins são descartados", () => {
    const p = normalizarPref({ bpm: 9999, compasso: 5, recentes: [{ bpm: 100, compasso: 4 }, { bpm: "x", compasso: 4 }, { bpm: 80, compasso: 7 }, null, 3] });
    expect(p.bpm).toBe(240);
    expect(p.compasso).toBe(4);
    expect(p.recentes).toEqual([{ bpm: 100, compasso: 4 }]);
  });

  it("JSON quebrado ou de outro tipo volta ao padrão", () => {
    armazenamento().set(CHAVE_METRONOMO, "{nao e json");
    expect(lerMetronomo()).toEqual(prefPadrao());
    expect(normalizarPref([1, 2])).toEqual(prefPadrao());
    expect(normalizarPref("x")).toEqual(prefPadrao());
  });

  it("a lista não repete (o item sobe ao topo) e guarda no máximo 10", () => {
    let l = adicionarRecente([], { bpm: 60, compasso: 4 });
    l = adicionarRecente(l, { bpm: 90, compasso: 3 });
    l = adicionarRecente(l, { bpm: 60, compasso: 4 });
    expect(l).toEqual([{ bpm: 60, compasso: 4 }, { bpm: 90, compasso: 3 }]);
    for (let b = 100; b < 130; b++) l = adicionarRecente(l, { bpm: b, compasso: 2 });
    expect(l).toHaveLength(RECENTES_MAX);
    expect(l[0]).toEqual({ bpm: 129, compasso: 2 });
  });

  it("a ordem da lista guardada é mantida ao ler", () => {
    const p = normalizarPref({ recentes: [{ bpm: 50, compasso: 2 }, { bpm: 60, compasso: 3 }, { bpm: 70, compasso: 4 }] });
    expect(p.recentes.map((r) => r.bpm)).toEqual([50, 60, 70]);
  });

  it("sem localStorage, não falha", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(lerMetronomo()).toEqual(prefPadrao());
    expect(() => salvarMetronomo(prefPadrao())).not.toThrow();
  });
});
