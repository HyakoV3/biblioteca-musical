import { describe, expect, it } from "vitest";
import {
  PAUSA_ENTRE_PARTES_S,
  VEZES_MAX,
  duracaoEmBatidas,
  ehFinal,
  montarTudo,
  parteNaBatida,
  partesDoTudo,
  temFinal,
  temIntroducao,
  totalDeVezes,
  vozesDaIntroducao,
  vozesDaVez,
} from "../src/lib/vezes";
import type { Voz } from "../src/lib/sintetizador";
import { hinoComFinal, hinoSimples } from "./amostras";

// Passada normal de 2 batidas, final de 4 e introdução de 1, para as contas ficarem à vista.
const normal: Voz[] = [
  { nome: "S", notas: [[0, 1, 60], [1, 1, 62]] },
  { nome: "B", notas: [[0, 2, 48]] },
];
const fin: Voz[] = [
  { nome: "S", notas: [[0, 4, 64]] },
  { nome: "B", notas: [[0, 4, 48]] },
];
const intro = { vozes: [{ nome: "S", notas: [[0, 1, 72]] as Voz["notas"] }, { nome: "B", notas: [[0, 1, 40]] as Voz["notas"] }] };
const com = { vozes: normal, final: { vozes: fin }, introducao: intro };
const sem = { vozes: normal, introducao: intro };

describe("final e número de vezes", () => {
  it("só tem final se as vozes casam em número", () => {
    expect(temFinal(com)).toBe(true);
    expect(temFinal({ vozes: normal })).toBe(false);
    expect(temFinal({ vozes: normal, final: { vozes: [fin[0]] } })).toBe(false);
    expect(temFinal({ vozes: [], final: { vozes: [] } })).toBe(false);
  });

  it("uma vez por estrofe; com final, no mínimo 2; teto de VEZES_MAX", () => {
    expect([5, 1, 0, 20, NaN, 3.9].map((n) => totalDeVezes(sem, n))).toEqual([5, 1, 1, VEZES_MAX, 1, 3]);
    expect([3, 1, 0, 20, NaN].map((n) => totalDeVezes(com, n))).toEqual([3, 2, 2, VEZES_MAX, 2]);
  });

  it("só a última vez é o final, e só em hino com final", () => {
    expect([1, 2, 3].map((v) => ehFinal(com, v, 3))).toEqual([false, false, true]);
    expect([1, 2, 3].map((v) => ehFinal(sem, v, 3))).toEqual([false, false, false]);
  });

  it("escolhe as notas da vez, com vez fora do intervalo limitada", () => {
    expect(vozesDaVez(com, 1, 3)).toBe(normal);
    expect(vozesDaVez(com, 2, 3)).toBe(normal);
    expect(vozesDaVez(com, 3, 3)).toBe(fin);
    expect(vozesDaVez(com, 0, 3)).toBe(normal);
    expect(vozesDaVez(com, 99, 3)).toBe(fin);
    expect(vozesDaVez(com, NaN, 3)).toBe(normal);
    expect(vozesDaVez(sem, 3, 1)).toBe(normal);
  });

  it("mede a duração em batidas e não altera a entrada", () => {
    expect(duracaoEmBatidas(normal)).toBe(2);
    expect(duracaoEmBatidas(fin)).toBe(4);
    expect(normal[0].notas.length).toBe(2);
  });
});

describe("introdução", () => {
  it("só vale com as mesmas vozes e alguma nota", () => {
    expect(PAUSA_ENTRE_PARTES_S).toBe(2);
    expect(temIntroducao(com)).toBe(true);
    expect(temIntroducao({ vozes: normal })).toBe(false);
    expect(temIntroducao({ vozes: normal, introducao: { vozes: [intro.vozes[0]] } })).toBe(false);
    expect(temIntroducao({ vozes: normal, introducao: { vozes: [{ nome: "S", notas: [] }, { nome: "B", notas: [] }] } })).toBe(false);
    expect(vozesDaIntroducao({ vozes: normal })).toEqual([]);
    expect(vozesDaIntroducao(com)).toBe(intro.vozes);
  });
});

describe("hino todo (introdução, vezes e pausas)", () => {
  it("junta as partes com pausa de 3 batidas", () => {
    // intro 0-1 | pausa | normal 4-6 | pausa | normal 9-11 | pausa | final 14-18
    const t = montarTudo(com, 3, 3);
    expect(t[0].notas).toEqual([[0, 1, 72], [4, 1, 60], [5, 1, 62], [9, 1, 60], [10, 1, 62], [14, 4, 64]]);
    expect(t[1].notas).toEqual([[0, 1, 40], [4, 2, 48], [9, 2, 48], [14, 4, 48]]);
    expect(duracaoEmBatidas(t)).toBe(18);
    expect(t.map((v) => v.nome)).toEqual(["S", "B"]);
  });

  it("sem pausa, com pausa inválida, sem introdução e sem final", () => {
    expect(duracaoEmBatidas(montarTudo(com, 3))).toBe(1 + 2 + 2 + 4);
    expect(duracaoEmBatidas(montarTudo(com, 3, NaN))).toBe(9);
    expect(duracaoEmBatidas(montarTudo(com, 3, -5))).toBe(9);
    const s = montarTudo({ vozes: normal, final: { vozes: fin } }, 2, 3);
    expect(s[0].notas[0]).toEqual([0, 1, 60]); // sem introdução, nada de pausa no começo
    expect(duracaoEmBatidas(s)).toBe(2 + 3 + 4);
    expect(duracaoEmBatidas(montarTudo({ vozes: normal, introducao: intro }, 1, 3))).toBe(1 + 3 + 2);
    expect(montarTudo({ vozes: normal }, 1, 3)[0].notas).toEqual(normal[0].notas);
  });

  it("dá os limites de cada parte", () => {
    const p = partesDoTudo(com, 3, 3);
    expect(p.map((x) => [x.parte, x.inicio, x.fim])).toEqual([["intro", 0, 1], [1, 4, 6], [2, 9, 11], [3, 14, 18]]);
    expect(partesDoTudo(sem, 3, 0).map((x) => [x.parte, x.inicio, x.fim])).toEqual([["intro", 0, 1], [1, 1, 3], [2, 3, 5], [3, 5, 7]]);
    expect(partesDoTudo({ vozes: normal }, 2, 0).map((x) => x.parte)).toEqual([1, 2]);
  });

  it("diz qual parte soa em cada batida (na pausa vale a que acabou)", () => {
    const p = partesDoTudo(com, 3, 3);
    const q = (b: number) => parteNaBatida(p, b);
    expect([0, 0.5, 2, 3.9].map(q)).toEqual(["intro", "intro", "intro", "intro"]);
    expect([4, 5.9, 6, 8.9].map(q)).toEqual([1, 1, 1, 1]);
    expect([9, 13.9].map(q)).toEqual([2, 2]);
    expect([14, 17, 18, 999].map(q)).toEqual([3, 3, 3, 3]);
    expect(parteNaBatida([], 3)).toBeNull();
    expect(parteNaBatida(partesDoTudo({ vozes: normal }, 2, 0), 0)).toBe(1);
    expect(parteNaBatida(p, -1)).toBe("intro");
  });

  it("com a estrutura de um hino com final (dados fictícios): 48, 48 e 96 batidas", () => {
    const h = hinoComFinal();
    const total = totalDeVezes(h, 3);
    expect(total).toBe(3);
    expect([1, 2, 3].map((v) => duracaoEmBatidas(vozesDaVez(h, v, total)))).toEqual([48, 48, 96]);
    const pausa = (PAUSA_ENTRE_PARTES_S * 52) / 60;
    expect(duracaoEmBatidas(montarTudo(h, total, pausa))).toBeCloseTo(11 + 48 + 48 + 96 + 3 * pausa, 9);
    const partes = partesDoTudo(h, total, pausa);
    expect(partes[0].parte).toBe("intro");
    expect(partes).toHaveLength(total + 1);
    for (let i = 1; i < partes.length; i++) expect(partes[i].inicio).toBeCloseTo(partes[i - 1].fim + pausa, 9);
  });

  it("hino sem final tem a mesma música em todas as vezes", () => {
    const h = hinoSimples();
    expect(totalDeVezes(h, 4)).toBe(4);
    expect(duracaoEmBatidas(vozesDaVez(h, 4, 4))).toBe(24);
    expect(ehFinal(h, 4, 4)).toBe(false);
  });
});
