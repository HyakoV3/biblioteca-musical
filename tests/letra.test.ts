import { describe, expect, it } from "vitest";
import { estrofes, totalDeEstrofes } from "../src/lib/letra";
import { marcasDaVez, sincroniaCombina, type Sincronia } from "../src/lib/karaoke";

const LETRA = ["1. um dois", "tres", "", "Coro. alfa beta", "gama", "", "2. quatro", "", "3. cinco"];

describe("coro na letra", () => {
  it("o parágrafo 'Coro. ' vira o coro, sem o prefixo, com número 0", () => {
    const e = estrofes(LETRA);
    expect(e.map((x) => x.numero)).toEqual([1, 0, 2, 3]);
    expect(e[1]).toEqual({ numero: 0, linhas: ["alfa beta", "gama"], coro: true });
    expect(e[0].coro).toBeUndefined();
  });

  it("o coro não conta como uma vez a mais", () => {
    expect(totalDeEstrofes(LETRA)).toBe(3);
    expect(totalDeEstrofes(["1. a", "", "2. b"])).toBe(2);
  });

  it("a sincronia da estrofe 0 combina com o coro e acende depois de cada estrofe", () => {
    const s: Sincronia = {
      normal: [
        { estrofe: 1, linhas: [[[0, 0, 3]], [[1, 0, 4]]] },
        { estrofe: 0, linhas: [[[4, 0, 4]], [[5, 0, 4]]] },
        { estrofe: 2, linhas: [[[0, 0, 3], [3, 3, 6]]] },
        { estrofe: 3, linhas: [[[0, 0, 5]]] },
      ],
    };
    expect(sincroniaCombina(LETRA, s)).toBe(true);
    // na 2ª vez: a estrofe 2 e, depois dela, o coro
    expect(marcasDaVez(s.normal, 2).map((m) => m.estrofe)).toEqual([2, 2, 0, 0]);
  });
});

describe("final na letra", () => {
  const LETRA_FINAL = ["1. um", "", "2. dois", "tres", "", "Final. alfa", "beta"];
  it("o parágrafo 'Final. ' vira o final, sem o prefixo, com número 0", () => {
    const e = estrofes(LETRA_FINAL);
    expect(e.map((x) => x.numero)).toEqual([1, 2, 0]);
    expect(e[2]).toEqual({ numero: 0, linhas: ["alfa", "beta"], final: true });
  });
  it("o final não conta como uma vez a mais", () => {
    expect(totalDeEstrofes(LETRA_FINAL)).toBe(2);
  });
  it("a sincronia da estrofe 0 combina com o final, e só a passada do final acende o texto dele", () => {
    const vazio = [[], []] as never[][];
    const s: Sincronia = {
      normal: [
        { estrofe: 1, linhas: [[[0, 0, 2]]] },
        { estrofe: 2, linhas: [[[0, 0, 4]], [[1, 0, 4]]] },
        { estrofe: 0, linhas: vazio },
      ],
      final: [
        { estrofe: 1, linhas: [[[0, 0, 2]]] },
        { estrofe: 2, linhas: [[[0, 0, 4]], [[1, 0, 4]]] },
        { estrofe: 0, linhas: [[[2, 0, 4]], [[3, 0, 4]]] },
      ],
    };
    expect(sincroniaCombina(LETRA_FINAL, s)).toBe(true);
    expect(marcasDaVez(s.normal, 2).map((m) => m.estrofe)).toEqual([2, 2]);
    expect(marcasDaVez(s.final!, 2).map((m) => m.estrofe)).toEqual([2, 2, 0, 0]);
  });
});
