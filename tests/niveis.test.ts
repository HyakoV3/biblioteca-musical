import { describe, expect, it } from "vitest";
import dados from "../src/lib/niveis-gravados.json";
import {
  IDS_COM_NIVEIS,
  VELOCIDADE_BASE,
  VELOCIDADE_MAXIMA,
  VELOCIDADE_MINIMA,
  correcaoDb,
  velocidadeDaNota,
  velocidadeParaCorrecao,
} from "../src/lib/niveis";
import { IDS_REALISTAS, REALISTAS, type RealistaId } from "../src/lib/realista";

// A faixa de cada voz, a mesma de tools/analisar-timbres.py (FAIXA_VOZ): de onde sai a faixa de uso de cada gravado.
const FAIXA_VOZ = { soprano: [60, 81], contralto: [55, 74], tenor: [48, 67], baixo: [40, 60] } as const;
const MARGEM = 6; // o app transpõe de -6 a +6 semitons
const BANCO = [30, 86] as const; // as notas que o banco tem
const tabelas = dados.instrumentos as unknown as Record<string, { de: number; db: number[] }>;

// O ganho que o smplr dá a uma velocity (src/smplr/volume.ts: midiVelToGain), em dB em relação à velocity 90.
const ganhoDoSmplrEmDb = (v: number) => 20 * Math.log10((v * v) / 16129) - 20 * Math.log10((VELOCIDADE_BASE * VELOCIDADE_BASE) / 16129);

describe("velocidadeParaCorrecao: dB -> velocity do smplr", () => {
  it("0 dB é a velocity de sempre (90)", () => {
    expect(velocidadeParaCorrecao(0)).toBe(VELOCIDADE_BASE);
  });

  it("produz EXATAMENTE a correção pedida, no ganho real do smplr (velocity²/16129)", () => {
    for (const db of [-12, -6, -3, -1, 0.5, 1, 3, 5, 5.9]) {
      expect(ganhoDoSmplrEmDb(velocidadeParaCorrecao(db)), `${db} dB`).toBeCloseTo(db, 6);
    }
  });

  it("o reforço máximo da tabela cabe em 127 (acima disso a nota some: nenhuma região do banco casa)", () => {
    expect(velocidadeParaCorrecao(5.9)).toBeLessThanOrEqual(VELOCIDADE_MAXIMA);
    expect(velocidadeParaCorrecao(5.9)).toBeGreaterThan(VELOCIDADE_MAXIMA - 1);
  });

  it("limita a 1..127: reforço demais não passa de 127 e corte demais não chega a 0 (velocity 0 é silêncio)", () => {
    expect(velocidadeParaCorrecao(20)).toBe(VELOCIDADE_MAXIMA);
    expect(velocidadeParaCorrecao(1000)).toBe(VELOCIDADE_MAXIMA);
    expect(velocidadeParaCorrecao(-200)).toBe(VELOCIDADE_MINIMA);
    expect(velocidadeParaCorrecao(-1000)).toBe(VELOCIDADE_MINIMA);
  });

  it("é crescente: mais dB, mais velocity", () => {
    let anterior = 0;
    for (let db = -12; db <= 5.9; db += 0.5) {
      const v = velocidadeParaCorrecao(db);
      expect(v).toBeGreaterThan(anterior);
      anterior = v;
    }
  });
});

describe("o mapa gravado (niveis-gravados.json)", () => {
  it("tem exatamente os gravados do catálogo", () => {
    expect([...IDS_COM_NIVEIS].sort()).toEqual([...IDS_REALISTAS].sort());
  });

  it("os limites escritos no arquivo são os que o app respeita", () => {
    expect(dados.limites_db).toEqual([-12, 5.9]);
  });

  it("cada tabela é contígua, dentro do banco, e com correções finitas e dentro dos limites", () => {
    for (const id of IDS_REALISTAS) {
      const t = tabelas[id];
      expect(t.db.length, id).toBeGreaterThan(0);
      expect(t.de, id).toBeGreaterThanOrEqual(BANCO[0]);
      expect(t.de + t.db.length - 1, id).toBeLessThanOrEqual(BANCO[1]);
      for (const v of t.db) {
        expect(Number.isFinite(v), id).toBe(true);
        expect(v, id).toBeGreaterThanOrEqual(-12);
        expect(v, id).toBeLessThanOrEqual(5.9);
      }
    }
  });

  it("cada tabela cobre a faixa das vozes do instrumento mais a margem de transposição", () => {
    for (const id of IDS_REALISTAS) {
      const vozes = REALISTAS[id].vozes as readonly (keyof typeof FAIXA_VOZ)[];
      const lo = Math.min(...vozes.map((v) => FAIXA_VOZ[v][0]));
      const hi = Math.max(...vozes.map((v) => FAIXA_VOZ[v][1]));
      const t = tabelas[id];
      expect(t.de, id).toBeLessThanOrEqual(Math.max(BANCO[0], lo - MARGEM));
      expect(t.de + t.db.length - 1, id).toBeGreaterThanOrEqual(Math.min(BANCO[1], hi + MARGEM));
    }
  });

  it("nivela de verdade: a média em potência das correções na faixa de uso é perto de 0 dB (o volume geral não muda)", () => {
    for (const id of IDS_REALISTAS) {
      const vozes = REALISTAS[id].vozes as readonly (keyof typeof FAIXA_VOZ)[];
      const lo = Math.min(...vozes.map((v) => FAIXA_VOZ[v][0]));
      const hi = Math.max(...vozes.map((v) => FAIXA_VOZ[v][1]));
      const t = tabelas[id];
      const dentro = t.db.filter((_, i) => t.de + i >= lo && t.de + i <= hi);
      // a correção é "referência - nível": tirar a média em potência do NÍVEL equivale a esta média das correções em amplitude ser ~1
      const media = dentro.reduce((a, v) => a + 10 ** (-v / 10), 0) / dentro.length;
      expect(10 * Math.log10(media), id).toBeLessThan(0.5);
      expect(10 * Math.log10(media), id).toBeGreaterThan(-3);
    }
  });
});

describe("correcaoDb", () => {
  const id: RealistaId = "real_flauta";
  const t = tabelas[id];

  it("lê a nota da tabela (a altura que SOA)", () => {
    expect(correcaoDb(id, t.de)).toBe(t.db[0]);
    expect(correcaoDb(id, t.de + 5)).toBe(t.db[5]);
    expect(correcaoDb(id, t.de + t.db.length - 1)).toBe(t.db[t.db.length - 1]);
  });

  it("fora da faixa medida vale a borda mais próxima", () => {
    expect(correcaoDb(id, t.de - 20)).toBe(t.db[0]);
    expect(correcaoDb(id, 0)).toBe(t.db[0]);
    expect(correcaoDb(id, t.de + t.db.length + 30)).toBe(t.db[t.db.length - 1]);
    expect(correcaoDb(id, 200)).toBe(t.db[t.db.length - 1]);
  });

  it("altura fracionária arredonda para a nota mais próxima", () => {
    // num ponto onde a nota seguinte tem OUTRO valor (no começo da tabela da flauta as correções são todas o teto, +5,9, e iguais)
    const k = t.db.findIndex((v, i) => i < t.db.length - 1 && v !== t.db[i + 1]);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(correcaoDb(id, t.de + k + 0.4)).toBe(t.db[k]);
    expect(correcaoDb(id, t.de + k + 0.6)).toBe(t.db[k + 1]);
    expect(t.db[k]).not.toBe(t.db[k + 1]);
  });

  it("instrumento sem tabela ou altura inválida: 0 dB, sem erro", () => {
    expect(correcaoDb("real_inexistente" as RealistaId, 60)).toBe(0);
    for (const ruim of [NaN, Infinity, -Infinity]) expect(correcaoDb(id, ruim)).toBe(0);
  });

  it("a flauta, a de maior variação (10 dB), tem de fato correções de sinais opostos nas pontas", () => {
    // o agudo é o mais forte: a correção cai (negativa) em cima e sobe (positiva) embaixo
    expect(correcaoDb(id, 81)).toBeLessThan(0);
    expect(correcaoDb(id, 60)).toBeGreaterThan(0);
  });
});

describe("velocidadeDaNota", () => {
  it("sem nivelar é sempre a de antes (90), em qualquer nota", () => {
    for (const id of IDS_REALISTAS) for (const m of [30, 48, 60, 72, 86]) expect(velocidadeDaNota(id, m, false)).toBe(90);
  });

  it("nivelando, segue a tabela: velocity = 90·10^(dB/40), sempre entre 1 e 127", () => {
    for (const id of IDS_REALISTAS) {
      for (let m = 30; m <= 86; m++) {
        const v = velocidadeDaNota(id, m, true);
        expect(v).toBeCloseTo(velocidadeParaCorrecao(correcaoDb(id, m)), 9);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(127);
      }
    }
  });

  it("nivelar muda mesmo a velocity (não é um no-op): a flauta soa mais fraca no agudo e mais forte no grave", () => {
    expect(velocidadeDaNota("real_flauta", 81, true)).toBeLessThan(90);
    expect(velocidadeDaNota("real_flauta", 60, true)).toBeGreaterThan(90);
  });
});
