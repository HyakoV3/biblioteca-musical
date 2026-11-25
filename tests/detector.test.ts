import { describe, expect, it } from "vitest";
import { CONGELAR_MS, CONFIRMAR_SALTO, Estabilizador, JANELA, Medidor, leituraValida, rms, type Bruta } from "../src/lib/detector";
import { frequenciaDe, notaEscrita, notaMaisProxima } from "../src/lib/afinador";

const TAXA = 48000;

/** Uma janela de som sintético: soma de harmônicos (amplitudes relativas), com ruído opcional. */
function som(freq: number, harmonicos: number[] = [1], ruido = 0, taxa = TAXA): Float32Array {
  let semente = 12345;
  const alea = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
  const soma = harmonicos.reduce((a, b) => a + b, 0);
  return Float32Array.from({ length: JANELA }, (_, i) => {
    let v = 0;
    harmonicos.forEach((a, k) => (v += a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / taxa)));
    return (0.4 * v) / soma + ruido * alea();
  });
}

describe("Medidor (pitchy)", () => {
  const medidor = new Medidor();
  it("acha tons puros da tuba ao agudo", () => {
    for (const f of [41.2, 58.3, 110, 261.63, 440, 1000, 2000]) {
      const b = medidor.medir(som(f), TAXA)!;
      expect(b, `${f} Hz`).not.toBeNull();
      expect(Math.abs(1200 * Math.log2(b.freq / f)), `${f} Hz`).toBeLessThan(5);
      expect(leituraValida(b)).toBe(true);
    }
  });
  it("acha a nota de um som de metal (fundamental fraco, harmônicos fortes)", () => {
    const f = frequenciaDe(58); // Si♭3, soa quando o trompete lê Dó4
    const b = medidor.medir(som(f, [0.3, 1, 0.9, 0.7, 0.5, 0.3, 0.2]), TAXA)!;
    expect(notaMaisProxima(b.freq)?.midi).toBe(58);
    expect(b.clareza).toBeGreaterThan(0.9);
  });
  it("com ruído leve ainda acha; com ruído puro não vira nota", () => {
    const f = 440;
    expect(notaMaisProxima(medidor.medir(som(f, [1, 0.5], 0.03), TAXA)!.freq)?.midi).toBe(69);
    const ruido = som(440, [0], 0.3); // só ruído
    const b = medidor.medir(ruido, TAXA);
    expect(leituraValida(b)).toBe(false);
  });
  it("silêncio e som fraco: nulo", () => {
    expect(medidor.medir(new Float32Array(JANELA), TAXA)).toBeNull();
    expect(medidor.medir(som(440).map((x) => x * 0.01), TAXA)).toBeNull();
  });
  it("rms de uma senoide de amplitude 0,4 é ~0,283", () => {
    expect(rms(som(440))).toBeCloseTo(0.4 / Math.SQRT2, 2);
    expect(rms([])).toBe(0);
  });
});

describe("leituraValida", () => {
  const ok: Bruta = { freq: 440, clareza: 0.95, volume: 0.1 };
  it("recusa fora da faixa, clareza baixa, volume baixo e valores inválidos", () => {
    expect(leituraValida(ok)).toBe(true);
    expect(leituraValida({ ...ok, freq: 20 })).toBe(false);
    expect(leituraValida({ ...ok, freq: 3000 })).toBe(false);
    expect(leituraValida({ ...ok, clareza: 0.5 })).toBe(false);
    expect(leituraValida({ ...ok, volume: 0.001 })).toBe(false);
    expect(leituraValida({ ...ok, freq: NaN })).toBe(false);
    expect(leituraValida(null)).toBe(false);
  });
});

describe("Estabilizador", () => {
  const b = (freq: number): Bruta => ({ freq, clareza: 0.97, volume: 0.1 });

  it("dá a nota e os cents; a mediana segura o vibrato", () => {
    const e = new Estabilizador();
    let r = e.entrar(0, b(440));
    expect(r).toMatchObject({ tipo: "nota", leitura: { midi: 69 } });
    for (let t = 50, i = 0; t <= 400; t += 50, i++) r = e.entrar(t, b(440 * 2 ** ((i % 2 ? 20 : -20) / 1200))); // vibrato de ±20 cents
    expect(r.tipo).toBe("nota");
    if (r.tipo === "nota") expect(Math.abs(r.leitura.cents)).toBeLessThan(25);
  });

  it("o nome não pisca na fronteira entre duas notas (histerese)", () => {
    const e = new Estabilizador();
    e.entrar(0, b(440));
    const nomes = new Set<number>();
    for (let i = 1; i <= 12; i++) {
      const r = e.entrar(i * 50, b(440 * 2 ** ((i % 2 ? 52 : 48) / 1200))); // oscila em volta de +50 cents
      if (r.tipo === "nota") nomes.add(r.leitura.midi);
    }
    expect([...nomes]).toEqual([69]);
  });

  it("um erro de oitava de um quadro é ignorado; uma mudança de oitava que persiste vale", () => {
    const e = new Estabilizador();
    for (let i = 0; i < 5; i++) e.entrar(i * 50, b(220));
    const r1 = e.entrar(250, b(440)); // um quadro errado
    expect(r1).toMatchObject({ tipo: "nota", leitura: { midi: 57 } });
    let r = r1;
    for (let i = 0; i < CONFIRMAR_SALTO + 2; i++) r = e.entrar(300 + i * 50, b(440));
    expect(r).toMatchObject({ tipo: "nota", leitura: { midi: 69 } });
  });

  it("depois de uma pausa curta, uma nota uma oitava acima vale na hora (a mediana velha não decide)", () => {
    const e = new Estabilizador();
    for (const t of [0, 50, 100]) e.entrar(t, b(440));
    expect(e.entrar(400, null).tipo).toBe("congelada");
    expect(e.entrar(450, b(880))).toMatchObject({ tipo: "nota", leitura: { midi: 81 } });
  });

  it("depois do fim do som a última nota fica congelada por ~1 s e então volta ao silêncio", () => {
    const e = new Estabilizador();
    e.entrar(0, b(440));
    expect(e.entrar(500, null)).toMatchObject({ tipo: "congelada", leitura: { midi: 69 } });
    expect(e.entrar(CONGELAR_MS, null).tipo).toBe("congelada");
    expect(e.entrar(CONGELAR_MS + 1, null).tipo).toBe("silencio");
    expect(e.entrar(CONGELAR_MS + 100, b(440)).tipo).toBe("nota"); // uma nova nota depois do silêncio começa do zero
  });

  it("leitura ruim (clareza baixa) conta como sem som", () => {
    const e = new Estabilizador();
    expect(e.entrar(0, { freq: 440, clareza: 0.3, volume: 0.1 }).tipo).toBe("silencio");
  });
});

describe("transposição: o trompete em Si♭ lê um tom acima do que soa", () => {
  it("Si♭3 que soa é Dó4 escrito; Sol4 que soa é Lá4 escrito", () => {
    expect(notaEscrita(58, "si_bemol")).toBe(60);
    expect(notaEscrita(67, "si_bemol")).toBe(69);
    expect(notaEscrita(60, "concerto")).toBe(60);
    expect(notaEscrita(60, "fa")).toBe(67);
    expect(notaEscrita(60, "mi_bemol")).toBe(69);
  });
});
