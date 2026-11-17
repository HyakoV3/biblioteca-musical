import { describe, expect, it } from "vitest";
import type { Compassos, InicioDeCompasso } from "../src/lib/biblioteca.svelte";
import { compassoDoPonto, compassoEm, listaDoPonto } from "../src/lib/compassos";

// Como o do hino 457: anacruse de 0,5 batida e compassos de 3 batidas; os índices são os dos compassos ESCRITOS.
const normal: InicioDeCompasso[] = [[0, 0], [0.5, 1], [3.5, 2], [6.5, 3]];
// O final pula o compasso 2 (a 1ª casa) e segue com o 3 e o 4: o índice 2 NÃO aparece, e os instantes são os da régua da passada.
const final: InicioDeCompasso[] = [[0, 0], [0.5, 1], [3.5, 3], [6.5, 4]];
const intro: InicioDeCompasso[] = [[0, 0], [0.5, 1]];
const todos: Compassos = { normal, final, introducao: intro };

describe("compassoEm: o compasso que toca numa batida", () => {
  it("em cima do início de cada compasso já é ele; um instante antes ainda é o anterior", () => {
    expect(compassoEm(normal, 0)).toBe(0);
    expect(compassoEm(normal, 0.4999)).toBe(0);
    expect(compassoEm(normal, 0.5)).toBe(1);
    expect(compassoEm(normal, 3.4999)).toBe(1);
    expect(compassoEm(normal, 3.5)).toBe(2);
    expect(compassoEm(normal, 6.5)).toBe(3);
  });

  it("no meio de um compasso é o dele", () => {
    expect(compassoEm(normal, 1.7)).toBe(1);
    expect(compassoEm(normal, 5)).toBe(2);
  });

  it("depois do último compasso continua o último (a pausa entre as partes mantém o destaque)", () => {
    expect(compassoEm(normal, 9.5)).toBe(3);
    expect(compassoEm(normal, 1e6)).toBe(3);
  });

  it("antes do primeiro compasso, ou com batida inválida, ou lista vazia: nenhum", () => {
    expect(compassoEm([[2, 0], [4, 1]], 1)).toBeNull();
    expect(compassoEm([[2, 0], [4, 1]], 2)).toBe(0);
    for (const ruim of [NaN, Infinity, -Infinity]) expect(compassoEm(normal, ruim)).toBeNull();
    expect(compassoEm(normal, -0.5)).toBeNull();
    expect(compassoEm([], 3)).toBeNull();
  });

  it("a tolerância de ponto flutuante: 0,1+0,2 (=0,30000000000000004) ainda é o início de 0,3", () => {
    expect(compassoEm([[0, 0], [0.3, 1]], 0.1 + 0.2)).toBe(1);
    expect(compassoEm([[0, 0], [0.3, 1]], 0.3 - 1e-9)).toBe(1);
    expect(compassoEm([[0, 0], [0.3, 1]], 0.3 - 1e-3)).toBe(0);
  });

  it("devolve o ÍNDICE escrito, não a posição na lista (no final o índice pula)", () => {
    expect(compassoEm(final, 3.5)).toBe(3);
    expect(compassoEm(final, 7)).toBe(4);
    expect(compassoEm(final, 2)).toBe(1);
  });

  it("uma lista de um item só vale em qualquer batida a partir dele", () => {
    expect(compassoEm([[0, 5]], 0)).toBe(5);
    expect(compassoEm([[0, 5]], 123)).toBe(5);
  });

  it("acha o compasso certo numa lista longa (busca binária)", () => {
    const longa: InicioDeCompasso[] = Array.from({ length: 1000 }, (_, i) => [i * 4, i]);
    for (const i of [0, 1, 499, 500, 998, 999]) {
      expect(compassoEm(longa, i * 4)).toBe(i);
      expect(compassoEm(longa, i * 4 + 3.99)).toBe(i);
    }
  });
});

describe("listaDoPonto: qual lista vale", () => {
  it("a introdução usa a lista da introdução", () => {
    expect(listaDoPonto(todos, { parte: "intro", batida: 1, final: false })).toBe(intro);
  });

  it("introdução sem lista própria: nenhuma (e não a normal)", () => {
    expect(listaDoPonto({ normal }, { parte: "intro", batida: 1, final: false })).toBeNull();
    expect(listaDoPonto({ normal, introducao: null }, { parte: "intro", batida: 1, final: false })).toBeNull();
  });

  it("a última vez de um hino com final usa a lista do final; as outras vezes usam a normal", () => {
    expect(listaDoPonto(todos, { parte: 2, batida: 1, final: true })).toBe(final);
    expect(listaDoPonto(todos, { parte: 1, batida: 1, final: false })).toBe(normal);
  });

  it("a última vez sem lista do final (final descartado) cai na normal", () => {
    expect(listaDoPonto({ normal }, { parte: 2, batida: 1, final: true })).toBe(normal);
    expect(listaDoPonto({ normal, final: null }, { parte: 2, batida: 1, final: true })).toBe(normal);
  });
});

describe("compassoDoPonto: de ponta a ponta", () => {
  it("cada parte do hino 457 acende o compasso certo, na régua dela", () => {
    expect(compassoDoPonto(todos, { parte: "intro", batida: 0.2, final: false })).toBe(0);
    expect(compassoDoPonto(todos, { parte: "intro", batida: 4, final: false })).toBe(1);
    expect(compassoDoPonto(todos, { parte: 1, batida: 4, final: false })).toBe(2);
    expect(compassoDoPonto(todos, { parte: 2, batida: 4, final: true })).toBe(3); // o final pulou o 2
    expect(compassoDoPonto(todos, { parte: 2, batida: 7, final: true })).toBe(4);
  });

  it("sem compassos ou sem ponto: nenhum, sem erro", () => {
    expect(compassoDoPonto(null, { parte: 1, batida: 1, final: false })).toBeNull();
    expect(compassoDoPonto(undefined, { parte: 1, batida: 1, final: false })).toBeNull();
    expect(compassoDoPonto(todos, null)).toBeNull();
  });

  it("antes do primeiro compasso da parte: nenhum", () => {
    expect(compassoDoPonto({ normal: [[1, 0], [5, 1]] }, { parte: 1, batida: 0.5, final: false })).toBeNull();
  });
});
