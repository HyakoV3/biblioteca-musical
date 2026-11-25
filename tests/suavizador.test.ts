import { describe, expect, it } from "vitest";
import { SuavizadorDeCents, TAU_MS, ZONA_MORTA_CENTS } from "../src/lib/suavizador";
import { Estabilizador, type Bruta, type Estado } from "../src/lib/detector";

const nota = (midi: number, cents: number, extra: { repetida?: true } = {}): Estado => ({ tipo: "nota", leitura: { midi, cents }, freq: 440, ...extra });
const congelada = (midi: number, cents: number): Estado => ({ tipo: "congelada", leitura: { midi, cents }, freq: 440, repetida: true });
const SILENCIO: Estado = { tipo: "silencio" };

describe("SuavizadorDeCents: média exponencial simétrica", () => {
  it("o primeiro valor é o valor cru", () => {
    const s = new SuavizadorDeCents();
    expect(s.entrar(0, nota(69, 12.4))).toEqual({ suave: 12.4, mostrado: 12 });
  });

  it("silêncio devolve nulo e zera", () => {
    const s = new SuavizadorDeCents();
    s.entrar(0, nota(69, 30));
    expect(s.entrar(50, SILENCIO)).toBeNull();
    expect(s.entrar(100, nota(69, -20))?.suave).toBe(-20); // a volta do silêncio salta
  });

  it("um degrau chega a ~63% em τ e a ~90% em 2,3 τ, sem passar do valor", () => {
    const s = new SuavizadorDeCents();
    s.entrar(0, nota(69, 0));
    let v = 0;
    let t63 = -1;
    let t90 = -1;
    for (let t = 10; t <= 2000; t += 10) {
      v = s.entrar(t, nota(69, 40))!.suave;
      expect(v).toBeLessThanOrEqual(40);
      if (t63 < 0 && v >= 40 * 0.632) t63 = t;
      if (t90 < 0 && v >= 40 * 0.9) t90 = t;
    }
    expect(Math.abs(t63 - TAU_MS)).toBeLessThanOrEqual(10);
    expect(Math.abs(t90 - 2.3 * TAU_MS)).toBeLessThanOrEqual(20);
    expect(v).toBeGreaterThan(39.9);
  });

  it("é simétrica: o degrau para baixo é o espelho do degrau para cima", () => {
    const cima = new SuavizadorDeCents();
    const baixo = new SuavizadorDeCents();
    cima.entrar(0, nota(69, 0));
    baixo.entrar(0, nota(69, 0));
    for (let t = 50; t <= 400; t += 50) {
      expect(baixo.entrar(t, nota(69, -40))!.suave).toBeCloseTo(-cima.entrar(t, nota(69, 40))!.suave, 9);
    }
  });

  it("para uma entrada constante, passos de 50 ms e de 25 ms dão o mesmo valor no mesmo instante", () => {
    const a = new SuavizadorDeCents();
    const b = new SuavizadorDeCents();
    a.entrar(0, nota(69, 0));
    b.entrar(0, nota(69, 0));
    let va = 0;
    let vb = 0;
    for (let t = 50; t <= 300; t += 50) va = a.entrar(t, nota(69, 40))!.suave;
    for (let t = 25; t <= 300; t += 25) vb = b.entrar(t, nota(69, 40))!.suave;
    expect(va).toBeCloseTo(vb, 6);
  });

  it("ms inválido (0, negativo, NaN) segura o valor; ms enorme salta para o novo", () => {
    const s = new SuavizadorDeCents();
    s.entrar(1000, nota(69, 10));
    expect(s.entrar(1000, nota(69, 40))!.suave).toBe(10); // ms = 0
    expect(s.entrar(500, nota(69, 40))!.suave).toBe(10); // ms < 0
    expect(s.entrar(Number.NaN, nota(69, 40))!.suave).toBe(10); // NaN
    const t0 = 2000;
    s.entrar(t0, nota(69, 10));
    expect(s.entrar(t0 + 60_000, nota(69, 40))!.suave).toBeCloseTo(40, 6);
  });

  it("a troca da nota que SOA salta (a trilha se recentra); a mesma nota desliza", () => {
    const s = new SuavizadorDeCents();
    s.entrar(0, nota(69, 0));
    for (let t = 50; t <= 300; t += 50) s.entrar(t, nota(69, 55));
    expect(s.entrar(350, nota(70, -45))!.suave).toBe(-45); // não desliza de +55 a −45
    const m = new SuavizadorDeCents();
    m.entrar(0, nota(69, 0));
    const v = m.entrar(50, nota(69, 40))!.suave;
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(40);
  });

  it("segura (não anda) na nota congelada e no quadro suspeito de oitava; depois da congelada a nota nova salta", () => {
    const s = new SuavizadorDeCents();
    s.entrar(0, nota(69, 10));
    s.entrar(50, nota(69, 20));
    const antes = s.entrar(100, nota(69, 20))!;
    // o Estabilizador devolve a MESMA leitura de antes enquanto congela: o valor não pode andar até ela
    for (let t = 150; t <= 1000; t += 50) expect(s.entrar(t, congelada(69, 20))).toEqual(antes);
    expect(s.entrar(1050, nota(69, -30))!.suave).toBe(-30); // voltou o som: salta
    const suspeito = new SuavizadorDeCents();
    suspeito.entrar(0, nota(69, 10));
    const v = suspeito.entrar(50, nota(69, 30))!;
    expect(suspeito.entrar(100, nota(69, 99, { repetida: true }))).toEqual(v);
  });

  it("trocar de instrumento (a nota escrita muda, o midi que soa não) não zera: a suavização só olha o midi que soa", () => {
    const s = new SuavizadorDeCents();
    s.entrar(0, nota(69, 0));
    const v = s.entrar(50, nota(69, 40))!.suave;
    expect(v).toBeLessThan(40); // continua suavizando
  });

  it("o número mostrado tem zona morta: oscilar em torno de um valor não o faz piscar", () => {
    const s = new SuavizadorDeCents(TAU_MS, ZONA_MORTA_CENTS);
    s.entrar(0, nota(69, 3));
    const mostrados = new Set<number>();
    for (let i = 1; i <= 40; i++) mostrados.add(s.entrar(i * 50, nota(69, 3 + (i % 2 ? 1 : -1)))!.mostrado); // ±1 cent de ruído
    expect(mostrados.size).toBe(1);
    // e quando a nota se afasta de verdade, o número acompanha
    let m = 3;
    for (let i = 41; i <= 80; i++) m = s.entrar(i * 50, nota(69, 25))!.mostrado;
    expect(m).toBe(25);
  });

  it("leitura com cents inválidos não derruba nem inventa valor", () => {
    const s = new SuavizadorDeCents();
    expect(s.entrar(0, nota(69, Number.NaN))).toBeNull();
    s.entrar(50, nota(69, 10));
    expect(s.entrar(100, nota(69, Number.NaN))!.suave).toBe(10);
  });
});

describe("Estabilizador marca a leitura repetida", () => {
  const b = (freq: number): Bruta => ({ freq, clareza: 0.97, volume: 0.1 });
  it("a nota congelada e o quadro suspeito de oitava são `repetida`; a nota viva não", () => {
    const e = new Estabilizador();
    for (let i = 0; i < 5; i++) expect(e.entrar(i * 50, b(220))).not.toHaveProperty("repetida");
    const suspeito = e.entrar(250, b(440));
    expect(suspeito).toMatchObject({ tipo: "nota", repetida: true });
    const viva = new Estabilizador();
    viva.entrar(0, b(440));
    expect(viva.entrar(500, null)).toMatchObject({ tipo: "congelada", repetida: true });
  });
});
