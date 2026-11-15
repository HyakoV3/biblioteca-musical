import { describe, expect, it } from "vitest";
import { marcaEm, marcasDaVez, sincroniaCombina, type EstrofeSinc, type Sincronia } from "../src/lib/karaoke";

// Letra fictícia: estrofe 1 com duas linhas ("bala" e "um"), estrofe 2 com "la lá" e "dois".
const letra = ["1. bala", "um", "", "2. la lá", "dois"];
const s: Sincronia = {
  normal: [
    { estrofe: 1, linhas: [[[0, 0, 2], [1, 2, 4]], [[2, 0, 2]]] },
    { estrofe: 2, linhas: [[[0, 0, 2], [1, 3, 5]], [[2, 0, 4]]] },
  ],
};

describe("sincroniaCombina", () => {
  it("aceita a sincronia certa e recusa o que não bate com a letra", () => {
    expect(sincroniaCombina(letra, s)).toBe(true);
    expect(sincroniaCombina(letra, null)).toBe(false);
    expect(sincroniaCombina(letra, { normal: [] })).toBe(false);
    expect(sincroniaCombina(["1. ba", "um"], s)).toBe(false); // linha mais curta que o trecho (letra editada)
    expect(sincroniaCombina(["1. bala"], s)).toBe(false); // estrofe inexistente
    expect(sincroniaCombina(letra, { normal: [{ estrofe: 1, linhas: [[[0, 3, 3]]] }] })).toBe(false); // de >= ate
    expect(sincroniaCombina(letra, { normal: [{ estrofe: 1, linhas: [[[0, 0, 2]], [[1, 0, 2]], [[2, 0, 2]]] }] })).toBe(false); // linhas demais
  });

  it("confere também a sincronia do final", () => {
    expect(sincroniaCombina(letra, { ...s, final: [{ estrofe: 2, linhas: [[[0, 0, 9]]] }] })).toBe(false);
    expect(sincroniaCombina(letra, { ...s, final: [{ estrofe: 2, linhas: [[[0, 0, 2]]] }] })).toBe(true);
  });

  it("conta unidades UTF-16: 'lá' tem 2, e o 'lá' de 'la lá' vai de 3 a 5", () => {
    expect(sincroniaCombina(letra, { normal: [{ estrofe: 2, linhas: [[[0, 3, 5]]] }] })).toBe(true);
  });
});

describe("marcasDaVez e marcaEm", () => {
  it("na vez 1 valem só as marcas da estrofe 1", () => {
    const m1 = marcasDaVez(s.normal, 1);
    expect(m1.map((m) => [m.t, m.estrofe])).toEqual([[0, 1], [1, 1], [2, 1]]);
    expect(marcaEm(m1, -1)).toBeNull(); // antes de começar
    expect(marcaEm(m1, 0)?.de).toBe(0);
    expect(marcaEm(m1, 0.99)?.de).toBe(0); // pouco antes da 2ª, ainda a 1ª
    expect(marcaEm(m1, 1)?.de).toBe(2);
    expect(marcaEm(m1, 2.5)?.linha).toBe(1);
    expect(marcaEm(m1, 999)?.linha).toBe(1); // depois do fim a última segue acesa
    expect(marcaEm([], 3)).toBeNull();
    expect(marcaEm(m1, NaN)).toBeNull();
  });

  it("na vez 2 vale a estrofe 2", () => {
    const m2 = marcasDaVez(s.normal, 2);
    expect(marcaEm(m2, 1)?.estrofe).toBe(2);
    expect(marcaEm(m2, 1)?.de).toBe(3);
  });

  it("o trecho final escrito sob a estrofe 1 acende também na vez da estrofe 3", () => {
    const final: EstrofeSinc[] = [
      { estrofe: 1, linhas: [[[0, 0, 2], [1, 2, 4]], [[2, 0, 2], [10, 3, 5], [11, 6, 8]]] },
      { estrofe: 3, linhas: [[[0, 0, 2], [1, 2, 4]], [[2, 0, 2]]] },
    ];
    const m3 = marcasDaVez(final, 3);
    expect(m3.map((m) => [m.t, m.estrofe])).toEqual([[0, 3], [1, 3], [2, 3], [10, 1], [11, 1]]);
    expect(marcaEm(m3, 5)?.estrofe).toBe(3); // no meio: a da vez manda
    expect(marcaEm(m3, 10.2)?.estrofe).toBe(1); // no trecho final: onde o texto está
    expect(marcaEm(m3, 11)?.de).toBe(6);
  });

  it("sem a estrofe da vez, valem todas as marcas", () => {
    expect(marcasDaVez(s.normal, 9)).toHaveLength(6);
  });

  it("empate no mesmo instante fora da estrofe da vez: vale a primeira", () => {
    const empate: EstrofeSinc[] = [
      { estrofe: 1, linhas: [[[5, 0, 2]]] },
      { estrofe: 2, linhas: [[[5, 0, 3]]] },
      { estrofe: 3, linhas: [[[0, 0, 1]]] },
    ];
    expect(marcaEm(marcasDaVez(empate, 3), 5)?.estrofe).toBe(1);
  });
});
