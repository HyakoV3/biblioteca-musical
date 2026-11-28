import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sintetizador, type Voz } from "../src/lib/sintetizador";
import type { InstrumentoId } from "../src/lib/instrumentos";

// Caracterização da síntese: grava, em ordem, cada criação, ligação e agendamento de parâmetro feitos no AudioContext
// (números arredondados a 6 casas: Math.log/pow variam entre versões do Node). O hash prende a ordem dos nós e as envoltórias.
let log: unknown[];
let contador: number;

const arred = (v: unknown): unknown => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);

function no(nome: string): Record<string, unknown> {
  const id = `${nome}${contador++}`;
  const param = (p: string) => {
    const alvo: Record<string, unknown> = { _v: 0 };
    return new Proxy(alvo, {
      get: (_, k) => (k === "value" ? alvo._v : (...a: unknown[]) => void log.push([id, p, k, ...a.map(arred)])),
      set: (_, k, v) => {
        if (k === "value") {
          alvo._v = v;
          log.push([id, p, "value=", arred(v)]);
        }
        return true;
      },
    });
  };
  const n: Record<string, unknown> = {
    gain: param("gain"),
    frequency: param("frequency"),
    detune: param("detune"),
    Q: param("Q"),
    connect: (x: { _id?: string }) => {
      log.push([id, "connect", x._id ?? "destino"]);
      return x;
    },
    disconnect: () => log.push([id, "disconnect"]),
    setPeriodicWave: (o: { harm: number[] }) => log.push([id, "onda", o.harm]),
    start: (t: number) => log.push([id, "start", arred(t)]),
    stop: (t: number) => log.push([id, "stop", arred(t)]),
    _id: id,
  };
  return new Proxy(n, {
    set: (t, k, v) => {
      if (k === "type") log.push([id, "type", v]);
      t[k as string] = v;
      return true;
    },
  });
}

class FakeCtx {
  currentTime = 0;
  state = "running";
  outputLatency = 0;
  sampleRate = 44100;
  destination = { _id: "destino" };
  async resume() {}
  async suspend() {}
  async close() {}
  createDynamicsCompressor = () => no("comp");
  createGain = () => no("gain");
  createBiquadFilter = () => no("filtro");
  createOscillator = () => no("osc");
  createPeriodicWave(re: Float32Array, im: Float32Array) {
    log.push(["onda", Array.from(re).length, Array.from(im).map(arred)]);
    return { harm: Array.from(im).map(arred) };
  }
}

beforeEach(() => {
  log = [];
  contador = 0;
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => vi.unstubAllGlobals());

const vozes: Voz[] = [
  { nome: "S", notas: [[0, 2, 60], [2, 0.01, 64], [3, 4, 72]] },
  { nome: "B", notas: [[0, 3, 43], [3, 1, 48], [5, 6, 55]] },
];

describe("caracterização do sintetizador", () => {
  it("a sequência de nós, ligações e envoltórias não muda", async () => {
    const s = new Sintetizador();
    const instrumentos: InstrumentoId[] = ["trombone", "flauta"];
    const dur1 = await s.tocar(vozes, { andamento: 90, transposicao: 2, instrumentos, volumes: [1, 0.5] });
    const dur2 = await s.tocar(vozes, { andamento: 70, transposicao: -3, instrumentos: ["oboe", "orgao_pleno"], volumes: [0, 1] }, { aPartirDe: 1.5, pausado: true });
    const resumo = { dur1: arred(dur1), dur2: arred(dur2), n: log.length, decorrido: arred(s.decorrido()) };
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([resumo, log])));
    const hash = [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
    expect({ resumo, hash }).toMatchInlineSnapshot(`
      {
        "hash": "48f73b32993bc8775c2e54f54b9c65f4ea11a563a7a9359f3641670a6569dac9",
        "resumo": {
          "decorrido": 1.285714,
          "dur1": 7.333333,
          "dur2": 9.428571,
          "n": 219,
        },
      }
    `);
  });
});
