import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { correcaoDb, velocidadeParaCorrecao } from "../src/lib/niveis";
import { Sintetizador, type Nota, type Voz } from "../src/lib/sintetizador";

// O smplr falso guarda cada nota pedida (a nota, a velocity e de qual instrumento): é o que prova que a velocity corrigida CHEGA ao smplr.
const iniciados = vi.hoisted(() => [] as { url: string; note: number; velocity: number }[]);
vi.mock("smplr", () => ({
  Soundfont: (_ctx: unknown, opcoes: { instrumentUrl: string }) => ({
    ready: Promise.resolve(),
    start: (e: { note: number; velocity: number }) => iniciados.push({ url: opcoes.instrumentUrl, note: e.note, velocity: e.velocity }),
    stop() {},
    scheduler: { stop() {} },
  }),
}));

class FakeCtx {
  currentTime = 0;
  state = "running";
  outputLatency = 0;
  destination = {};
  sampleRate = 44100;
  async resume() {}
  async suspend() {}
  private no() {
    return { connect: (x: unknown) => x, disconnect() {} };
  }
  createDynamicsCompressor() {
    return this.no();
  }
  createGain() {
    return { ...this.no(), gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} } };
  }
}

beforeEach(() => {
  iniciados.length = 0;
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => vi.unstubAllGlobals());

const notas: Nota[] = [[0, 2, 60], [2, 2, 66], [4, 2, 72], [6, 2, 81]];
const vozes: Voz[] = [{ nome: "S", notas }];
type Opcoes = Parameters<Sintetizador["tocar"]>[1];
const op = (extra: Partial<Opcoes> = {}): Opcoes => ({ andamento: 120, transposicao: 0, instrumentos: ["real_flauta"], volumes: [1], ...extra });
const velocities = (): number[] => iniciados.map((i) => i.velocity);

describe("Sintetizador: nivelar as notas dos gravados (I-23)", () => {
  it("por padrão (sem a opção) nivela: cada nota recebe a velocity da tabela, e não 90", async () => {
    await new Sintetizador().tocar(vozes, op());
    expect(iniciados).toHaveLength(4);
    const esperado = [60, 66, 72, 81].map((m) => velocidadeParaCorrecao(correcaoDb("real_flauta", m)));
    iniciados.forEach((i, k) => expect(i.velocity).toBeCloseTo(esperado[k], 9));
    expect(new Set(velocities()).size).toBeGreaterThan(1); // notas diferentes, velocities diferentes
    expect(velocities().some((v) => v !== 90)).toBe(true);
  });

  it("com nivelar desligado toca tudo na velocity de sempre (90)", async () => {
    await new Sintetizador().tocar(vozes, op({ nivelar: false }));
    expect(velocities()).toEqual([90, 90, 90, 90]);
  });

  it("nivelar ligado explícito = o padrão", async () => {
    await new Sintetizador().tocar(vozes, op({ nivelar: true }));
    const ligado = velocities();
    iniciados.length = 0;
    await new Sintetizador().tocar(vozes, op());
    expect(velocities()).toEqual(ligado);
  });

  it("a correção é pela altura que SOA: com transposição, a nota segue a tabela da altura transposta", async () => {
    await new Sintetizador().tocar(vozes, op({ transposicao: 5 }));
    expect(iniciados.map((i) => i.note)).toEqual([65, 71, 77, 86]);
    const esperado = [65, 71, 77, 86].map((m) => velocidadeParaCorrecao(correcaoDb("real_flauta", m)));
    iniciados.forEach((i, k) => expect(i.velocity).toBeCloseTo(esperado[k], 9));
  });

  it("cada voz usa a tabela do SEU instrumento", async () => {
    const duas: Voz[] = [{ nome: "S", notas: [[0, 2, 72]] }, { nome: "B", notas: [[0, 2, 48]] }];
    await new Sintetizador().tocar(duas, op({ instrumentos: ["real_flauta", "real_tuba"], volumes: [1, 1] }));
    const flauta = iniciados.find((i) => i.url.includes("flute"))!;
    const tuba = iniciados.find((i) => i.url.includes("tuba"))!;
    expect(flauta.velocity).toBeCloseTo(velocidadeParaCorrecao(correcaoDb("real_flauta", 72)), 9);
    expect(tuba.velocity).toBeCloseTo(velocidadeParaCorrecao(correcaoDb("real_tuba", 48)), 9);
  });

  it("nunca passa de 127 (acima, a nota some) nem cai a 0, em todas as notas e transposições", async () => {
    const todas: Voz[] = [{ nome: "S", notas: Array.from({ length: 27 }, (_, k): Nota => [k * 2, 2, 60 + k]) }];
    for (const transposicao of [-6, 0, 6]) {
      iniciados.length = 0;
      await new Sintetizador().tocar(todas, op({ transposicao }));
      for (const v of velocities()) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(127);
      }
    }
  });
});
