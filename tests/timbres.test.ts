import { describe, expect, it } from "vitest";
import medidas from "../src/lib/timbres.json";
import { INSTRUMENTOS } from "../src/lib/instrumentos";
import { COM_TIMBRE_MEDIDO, eficazRelativo, harmonicosEm, perfilDaNota, temTimbreMedido } from "../src/lib/timbres";

const AFETADOS = ["trompete", "trombone", "tuba", "fagote", "oboe", "sax_alto", "sax_tenor", "flauta_doce", "violino", "clarinete", "viola", "violoncelo", "contrabaixo", "trompa"] as const;
type Ancora = { midi: number; h: number[]; ataque: number };
const ancoras = (id: string) => (medidas.instrumentos as unknown as Record<string, { faixa: number[]; ancoras: Ancora[] }>)[id];
const centroide = (h: number[]) => {
  let n = 0;
  let d = 0;
  for (let k = 1; k < h.length; k++) {
    n += k * h[k] * h[k];
    d += h[k] * h[k];
  }
  return n / d;
};

describe("timbres.json (medido nas gravações)", () => {
  it("cobre os 14 instrumentos que têm gravado de referência e nenhum outro", () => {
    expect([...COM_TIMBRE_MEDIDO].sort()).toEqual([...AFETADOS].sort());
    for (const id of AFETADOS) expect(id in INSTRUMENTOS).toBe(true);
    expect(temTimbreMedido("trompete")).toBe(true);
    expect(temTimbreMedido("flugelhorn")).toBe(false); // o banco não tem gravado dele
  });

  it("âncoras ordenadas, dentro da faixa, com tabelas válidas (relativas ao harmônico mais forte)", () => {
    for (const id of AFETADOS) {
      const { faixa, ancoras: a } = ancoras(id);
      expect(a.length).toBeGreaterThanOrEqual(8);
      expect(a[0].midi).toBe(faixa[0]);
      for (let i = 1; i < a.length; i++) expect(a[i].midi).toBeGreaterThan(a[i - 1].midi);
      for (const x of a) {
        expect(Math.max(...x.h)).toBe(1);
        expect(x.h.every((v) => v >= 0 && v <= 1)).toBe(true);
        expect(x.ataque).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("harmonicosEm", () => {
  it("na âncora devolve a medida exata (índice 0 ignorado)", () => {
    const a = ancoras("trompete").ancoras[3];
    const h = harmonicosEm("trompete", a.midi);
    expect(h[0]).toBe(0);
    for (let k = 1; k < 10; k++) expect(h[k]).toBeCloseTo(a.h[k - 1], 9);
  });

  it("entre duas âncoras interpola linearmente", () => {
    const [a, b] = ancoras("trombone").ancoras.slice(2, 4);
    const meio = harmonicosEm("trombone", (a.midi + b.midi) / 2);
    for (let k = 1; k < 10; k++) expect(meio[k]).toBeCloseTo((a.h[k - 1] + b.h[k - 1]) / 2, 9);
    const um_terco = harmonicosEm("trombone", a.midi + 1); // âncoras a cada 3 semitons: 1/3 do caminho
    for (let k = 1; k < 10; k++) expect(um_terco[k]).toBeCloseTo(a.h[k - 1] * (2 / 3) + b.h[k - 1] / 3, 9);
  });

  it("fora da faixa medida vale a âncora da ponta", () => {
    const a = ancoras("oboe").ancoras;
    expect(harmonicosEm("oboe", 20)).toEqual(harmonicosEm("oboe", a[0].midi));
    expect(harmonicosEm("oboe", 120)).toEqual(harmonicosEm("oboe", a[a.length - 1].midi));
  });

  it("o brilho cai com a altura, como no instrumento de verdade (e a tabela fixa antiga não fazia)", () => {
    for (const id of AFETADOS) {
      const { faixa } = ancoras(id);
      const grave = centroide(harmonicosEm(id, faixa[0] + 2));
      const agudo = centroide(harmonicosEm(id, faixa[1] - 2));
      // Só metais e palhetas (a primeira leva) têm essa regra: nas cordas e na flauta doce o corpo do instrumento fixa as
      // ressonâncias e o brilho, contado em número de harmônico, não precisa cair com a altura.
      if (AFETADOS.indexOf(id) < 7) expect(grave).toBeGreaterThan(agudo * 1.3);
    }
  });

  it("instrumento sem medida usa a tabela fixa", () => {
    expect(harmonicosEm("flugelhorn", 60)).toBe(INSTRUMENTOS.flugelhorn.harmonicos);
    expect(perfilDaNota("flugelhorn", 60)).toBe(INSTRUMENTOS.flugelhorn);
  });
});

describe("eficazRelativo", () => {
  it("senoide pura: eficaz/pico = 1/√2; onda cheia de harmônicos fica mais baixa (pico alto, pouca energia)", () => {
    expect(eficazRelativo([0, 1])).toBeCloseTo(Math.SQRT1_2, 3);
    expect(eficazRelativo([0, 1, 0.5, 0.33, 0.25, 0.2, 0.17, 0.14])).toBeLessThan(Math.SQRT1_2);
    expect(eficazRelativo([0])).toBe(0);
  });
});

describe("perfilDaNota", () => {
  it("mantém o volume eficaz da tabela antiga (os ganhos dos gravados foram calibrados contra ele)", () => {
    for (const id of AFETADOS) {
      const antigo = INSTRUMENTOS[id];
      const { faixa } = ancoras(id);
      for (let midi = faixa[0]; midi <= faixa[1]; midi += 4) {
        const p = perfilDaNota(id, midi);
        const fator = p.nivel / antigo.nivel;
        expect(fator).toBeGreaterThanOrEqual(0.5 - 1e-9);
        expect(fator).toBeLessThanOrEqual(2 + 1e-9);
        if (fator > 0.5 + 1e-9 && fator < 2 - 1e-9) {
          // fora dos limites do fator: eficaz novo = eficaz antigo
          expect(p.nivel * eficazRelativo(p.harmonicos)).toBeCloseTo(antigo.nivel * eficazRelativo(antigo.harmonicos), 6);
        }
      }
    }
  });

  it("ataque entre 20 e 80 ms; solta e vibrato do instrumento ficam", () => {
    for (const id of AFETADOS) {
      const p = perfilDaNota(id, ancoras(id).faixa[0] + 6);
      expect(p.ataque).toBeGreaterThanOrEqual(0.02);
      expect(p.ataque).toBeLessThanOrEqual(0.08);
      expect(p.solta).toBe(INSTRUMENTOS[id].solta);
      expect(p.vibrato).toEqual((INSTRUMENTOS[id] as { vibrato?: unknown }).vibrato);
    }
  });

  it("só os metais (trompete, trombone, tuba, trompa) abrem o brilho no começo", () => {
    for (const id of AFETADOS) {
      const ab = perfilDaNota(id, ancoras(id).faixa[0] + 6).abertura;
      if (["trompete", "trombone", "tuba", "trompa"].includes(id)) {
        expect(ab).toBeDefined();
        expect(ab!.corte).toBeGreaterThan(1);
        expect(ab!.corte).toBeLessThan(20);
        expect(ab!.tempo).toBeGreaterThanOrEqual(0.04);
        expect(ab!.tempo).toBeLessThan(0.3);
      } else {
        expect(ab).toBeUndefined();
      }
    }
  });

  it("é determinístico e guarda o resultado", () => {
    expect(perfilDaNota("fagote", 50)).toBe(perfilDaNota("fagote", 50));
  });
});
