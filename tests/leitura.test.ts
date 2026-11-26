import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALINHAMENTOS, ESCALAS_LETRA, PASSO_PADRAO, escalaDoPasso, leituraPadrao, limitarPasso, normalizarLeitura } from "../src/lib/leitura";
import { lerLeitura, salvarLeitura } from "../src/lib/preferencias";

describe("tamanho da letra", () => {
  it("6 passos, de 85% a 160%, crescentes, com o padrão (100%) no índice certo", () => {
    expect(ESCALAS_LETRA).toHaveLength(6);
    expect(ESCALAS_LETRA[0]).toBe(0.85);
    expect(ESCALAS_LETRA[ESCALAS_LETRA.length - 1]).toBe(1.6);
    expect(ESCALAS_LETRA[PASSO_PADRAO]).toBe(1);
    for (let i = 1; i < ESCALAS_LETRA.length; i++) expect(ESCALAS_LETRA[i]).toBeGreaterThan(ESCALAS_LETRA[i - 1]);
  });

  it("limitarPasso: dentro dos limites; fora vira o limite; inválido vira o padrão", () => {
    expect(limitarPasso(0)).toBe(0);
    expect(limitarPasso(5)).toBe(5);
    expect(limitarPasso(-3)).toBe(0);
    expect(limitarPasso(99)).toBe(5);
    expect(limitarPasso(2.6)).toBe(3); // arredonda
    for (const ruim of [NaN, Infinity, "2", null, undefined, {}, []]) expect(limitarPasso(ruim)).toBe(PASSO_PADRAO);
  });

  it("escalaDoPasso devolve a escala do passo, também para passo fora dos limites", () => {
    expect(escalaDoPasso(0)).toBe(0.85);
    expect(escalaDoPasso(PASSO_PADRAO)).toBe(1);
    expect(escalaDoPasso(5)).toBe(1.6);
    expect(escalaDoPasso(100)).toBe(1.6);
    expect(escalaDoPasso(-1)).toBe(0.85);
  });
});

describe("normalizarLeitura (o que vem do armazenamento pode ser qualquer coisa)", () => {
  it("padrão: tamanho 100% e alinhamento à esquerda", () => {
    expect(leituraPadrao()).toEqual({ passo: PASSO_PADRAO, alinhamento: "esquerda" });
  });

  it("valores válidos passam", () => {
    for (const alinhamento of ALINHAMENTOS) expect(normalizarLeitura({ passo: 3, alinhamento })).toEqual({ passo: 3, alinhamento });
  });

  it("cada campo inválido volta ao padrão, sem perder o outro", () => {
    expect(normalizarLeitura({ passo: 4, alinhamento: "centro" })).toEqual({ passo: 4, alinhamento: "esquerda" });
    expect(normalizarLeitura({ passo: "grande", alinhamento: "direita" })).toEqual({ passo: PASSO_PADRAO, alinhamento: "direita" });
    expect(normalizarLeitura({ passo: 99, alinhamento: "centro" })).toEqual({ passo: 5, alinhamento: "centro" });
    // Quem tinha o antigo "justificado" salvo passa a ver a letra centralizada.
    expect(normalizarLeitura({ passo: 2, alinhamento: "justificado" })).toEqual({ passo: 2, alinhamento: "centro" });
  });

  it("não é objeto: padrão", () => {
    for (const ruim of [null, undefined, 3, "x", true]) expect(normalizarLeitura(ruim)).toEqual(leituraPadrao());
  });

  it("nomes herdados do objeto não passam por alinhamento", () => {
    for (const nome of ["constructor", "toString", "__proto__"]) expect(normalizarLeitura({ alinhamento: nome }).alinhamento).toBe("esquerda");
  });
});

describe("preferência salva no aparelho", () => {
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

  it("nada salvo: padrão", () => {
    expect(lerLeitura()).toEqual(leituraPadrao());
  });

  it("salva e lê de volta (sobrevive a fechar o app)", () => {
    salvarLeitura({ passo: 4, alinhamento: "centro" });
    expect(lerLeitura()).toEqual({ passo: 4, alinhamento: "centro" });
  });

  it("JSON quebrado, valor estranho ou armazenamento indisponível: padrão, sem erro", () => {
    mem["prefs.letra"] = "{ quebrado";
    expect(lerLeitura()).toEqual(leituraPadrao());
    mem["prefs.letra"] = '{"passo":999,"alinhamento":"x"}';
    expect(lerLeitura()).toEqual({ passo: 5, alinhamento: "esquerda" });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("sem armazenamento");
      },
      setItem: () => {
        throw new Error("sem armazenamento");
      },
    });
    expect(lerLeitura()).toEqual(leituraPadrao());
    expect(() => salvarLeitura({ passo: 2, alinhamento: "direita" })).not.toThrow();
  });
});
