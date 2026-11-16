import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ESCALAS_PARTITURA,
  ZOOM_PADRAO,
  escalaDoZoom,
  estadoDaPartitura,
  limitarZoom,
  normalizarZoom,
  passoDaEscala,
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
  it("9 passos de 50% a 400%, crescentes, com o padrão (100%, cabe na tela) no meio e dá para diminuir e aumentar", () => {
    expect(ESCALAS_PARTITURA).toHaveLength(9);
    expect(ESCALAS_PARTITURA[0]).toBe(0.5);
    expect(ESCALAS_PARTITURA[ESCALAS_PARTITURA.length - 1]).toBe(4);
    expect(ESCALAS_PARTITURA[ZOOM_PADRAO]).toBe(1);
    expect(ZOOM_PADRAO).toBeGreaterThan(0); // há passos menores que o padrão
    expect(ZOOM_PADRAO).toBeLessThan(ESCALAS_PARTITURA.length - 1); // e maiores
    for (let i = 1; i < ESCALAS_PARTITURA.length; i++) expect(ESCALAS_PARTITURA[i]).toBeGreaterThan(ESCALAS_PARTITURA[i - 1]);
  });

  it("limitarZoom: dentro dos limites; fora vira o limite; inválido vira o padrão", () => {
    expect(limitarZoom(0)).toBe(0);
    expect(limitarZoom(8)).toBe(8);
    expect(limitarZoom(-3)).toBe(0);
    expect(limitarZoom(99)).toBe(8);
    expect(limitarZoom(2.6)).toBe(3);
    for (const ruim of [NaN, Infinity, "2", null, undefined, {}, []]) expect(limitarZoom(ruim)).toBe(ZOOM_PADRAO);
  });

  it("escalaDoZoom devolve a escala do passo, também fora dos limites", () => {
    expect(escalaDoZoom(0)).toBe(0.5);
    expect(escalaDoZoom(ZOOM_PADRAO)).toBe(1);
    expect(escalaDoZoom(6)).toBe(2);
    expect(escalaDoZoom(100)).toBe(4);
    expect(escalaDoZoom(-1)).toBe(0.5);
  });

  it("passoDaEscala: só os degraus exatos valem; o resto volta ao padrão", () => {
    for (const [i, e] of ESCALAS_PARTITURA.entries()) expect(passoDaEscala(e)).toBe(i);
    for (const ruim of [1.1, 0.7, 5, 0, -1, NaN, "1", null, undefined, {}]) expect(passoDaEscala(ruim), String(ruim)).toBe(ZOOM_PADRAO);
  });

  it("normalizarZoom lê a ESCALA guardada e ignora a chave antiga (índice de quando os degraus eram outros)", () => {
    expect(normalizarZoom({ escala: 1.25 })).toBe(4);
    expect(normalizarZoom({ escala: 0.8 })).toBe(2);
    for (const ruim of [null, undefined, 3, "x", true, [], {}, { escala: "1.25" }, { escala: 7 }, { zoom: 3 }, { zoom: 0 }]) {
      expect(normalizarZoom(ruim), JSON.stringify(ruim)).toBe(ZOOM_PADRAO);
    }
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

  it("nada salvo: padrão; salva a ESCALA e lê de volta o mesmo passo", () => {
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
    salvarZoomPartitura(6);
    expect(mem["prefs.partitura"]).toBe('{"escala":2}');
    expect(lerZoomPartitura()).toBe(6);
    salvarZoomPartitura(0); // dá para guardar um tamanho menor que o padrão
    expect(mem["prefs.partitura"]).toBe('{"escala":0.5}');
    expect(lerZoomPartitura()).toBe(0);
  });

  it("o que estava salvo no formato antigo ({zoom: índice}) não vira um tamanho errado: volta ao padrão", () => {
    mem["prefs.partitura"] = '{"zoom":4}';
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
  });

  it("JSON quebrado, valor estranho ou armazenamento indisponível: padrão, sem erro", () => {
    mem["prefs.partitura"] = "{ quebrado";
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
    mem["prefs.partitura"] = '{"escala":999}';
    expect(lerZoomPartitura()).toBe(ZOOM_PADRAO);
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
