import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ESCALAS_PARTITURA,
  ZOOM_PADRAO,
  escalaDoZoom,
  estadoDaPartitura,
  limitarZoom,
  normalizarZoom,
  temAbaPartitura,
} from "../src/lib/partitura";
import { lerZoomPartitura, salvarZoomPartitura } from "../src/lib/preferencias";

describe("quando a aba Partitura aparece (decisão do responsável)", () => {
  it("com pacote importado: só nos hinos que têm partitura", () => {
    expect(estadoDaPartitura([1, 283, 457], 283)).toBe("tem");
    expect(estadoDaPartitura([1, 283, 457], 276)).toBe("nao_tem");
    expect(temAbaPartitura("tem")).toBe(true);
    expect(temAbaPartitura("nao_tem")).toBe(false);
  });

  it("sem nenhuma partitura instalada: a aba aparece, com o aviso para Ajustes (qualquer hino)", () => {
    for (const numero of [1, 283, 999]) {
      expect(estadoDaPartitura([], numero)).toBe("sem_pacote");
    }
    expect(temAbaPartitura("sem_pacote")).toBe(true);
  });

  it("o número tem de ser exatamente o do hino (nada de comparação frouxa)", () => {
    expect(estadoDaPartitura([28], 283)).toBe("nao_tem");
    expect(estadoDaPartitura([283], 28)).toBe("nao_tem");
    expect(estadoDaPartitura([1], NaN)).toBe("nao_tem");
    expect(estadoDaPartitura([], NaN)).toBe("sem_pacote");
  });
});

describe("zoom da partitura", () => {
  it("6 passos de 100% a 400%, crescentes, com o padrão (100%, cabe na tela) no índice 0", () => {
    expect(ESCALAS_PARTITURA).toHaveLength(6);
    expect(ESCALAS_PARTITURA[ZOOM_PADRAO]).toBe(1);
    expect(ESCALAS_PARTITURA[ESCALAS_PARTITURA.length - 1]).toBe(4);
    for (let i = 1; i < ESCALAS_PARTITURA.length; i++) expect(ESCALAS_PARTITURA[i]).toBeGreaterThan(ESCALAS_PARTITURA[i - 1]);
  });

  it("limitarZoom: dentro dos limites; fora vira o limite; inválido vira o padrão", () => {
    expect(limitarZoom(0)).toBe(0);
    expect(limitarZoom(5)).toBe(5);
    expect(limitarZoom(-3)).toBe(0);
    expect(limitarZoom(99)).toBe(5);
    expect(limitarZoom(2.6)).toBe(3);
    for (const ruim of [NaN, Infinity, "2", null, undefined, {}, []]) expect(limitarZoom(ruim)).toBe(ZOOM_PADRAO);
  });

  it("escalaDoZoom devolve a escala do passo, também fora dos limites", () => {
    expect(escalaDoZoom(0)).toBe(1);
    expect(escalaDoZoom(3)).toBe(2);
    expect(escalaDoZoom(100)).toBe(4);
    expect(escalaDoZoom(-1)).toBe(1);
  });

  it("normalizarZoom aceita qualquer coisa do armazenamento", () => {
    expect(normalizarZoom({ zoom: 3 })).toBe(3);
    expect(normalizarZoom({ zoom: 99 })).toBe(5);
    for (const ruim of [null, undefined, 3, "x", true, [], {}, { zoom: "3" }, { zoom: NaN }]) expect(normalizarZoom(ruim)).toBe(ZOOM_PADRAO);
  });
});

describe("zoom salvo no aparelho", () => {
  let mem: Record<string, string>;
  beforeEach(() => {
    mem = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in mem ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = String(v);
      },
    });
  });

  it("nada salvo: padrão; salva e lê de volta", () => {
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
    salvarZoomPartitura(4);
    expect(lerZoomPartitura()).toBe(4);
    expect(mem["prefs.partitura"]).toBe('{"zoom":4}');
  });

  it("JSON quebrado, valor estranho ou armazenamento indisponível: padrão, sem erro", () => {
    mem["prefs.partitura"] = "{ quebrado";
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
    mem["prefs.partitura"] = '{"zoom":999}';
    expect(lerZoomPartitura()).toBe(5);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("sem armazenamento");
      },
      setItem: () => {
        throw new Error("sem armazenamento");
      },
    });
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
    expect(() => salvarZoomPartitura(2)).not.toThrow();
  });
});
