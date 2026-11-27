// Caracterização do Estabilizador: uma sequência longa e determinística de leituras brutas (notas com vibrato, saltos de oitava, ruído, clareza e volume baixos, frequências fora da faixa, nulos,
// pausas longas) passa pelo estabilizador e o hash da saída (ponto flutuante exato, menos o `rms` da janela de seno) é comparado com o gravado antes do refactor.
import { describe, expect, it } from "vitest";
import { Estabilizador, rms, type Bruta } from "../src/lib/detector";
import esperado from "./fixtures/detector-caracterizacao.sha256?raw";

/** Gerador pseudoaleatório fixo (mulberry32). */
function aleatorio(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTAS_HZ = [110, 146.83, 220, 261.63, 440, 466.16, 880];

function brutaAleatoria(r: () => number, nota: number): Bruta | null {
  const sorteio = r();
  if (sorteio < 0.08) return null;
  if (sorteio < 0.12) return { freq: NaN, clareza: 0.95, volume: 0.1 };
  if (sorteio < 0.16) return { freq: r() < 0.5 ? 10 : 5000, clareza: 0.95, volume: 0.1 };
  if (sorteio < 0.2) return { freq: nota, clareza: 0.5, volume: 0.1 };
  if (sorteio < 0.24) return { freq: nota, clareza: 0.95, volume: 0.001 };
  const oitava = sorteio < 0.3 ? (r() < 0.5 ? 2 : 0.5) : 1; // quadros suspeitos de erro de oitava
  return { freq: nota * oitava * (1 + (r() - 0.5) * 0.03), clareza: 0.9 + r() * 0.1, volume: 0.01 + r() * 0.2 };
}

function percorrer(estabilizador: Estabilizador, semente: number): unknown[] {
  const r = aleatorio(semente);
  const saida: unknown[] = [];
  let agora = 0;
  let nota = 440;
  for (let i = 0; i < 6000; i++) {
    const sorteio = r();
    agora += sorteio < 0.02 ? 1500 : sorteio < 0.05 ? 400 : 10 + r() * 90;
    if (r() < 0.04) nota = NOTAS_HZ[Math.floor(r() * NOTAS_HZ.length)]!;
    saida.push(estabilizador.entrar(agora, brutaAleatoria(r, nota)));
  }
  return saida;
}

/** `Math.sin` não é idêntico entre versões do Node: o `rms` da janela entra com 9 casas, o resto (só aritmética) vai exato. */
const arredondar = (n: number): number => Number(n.toFixed(9));

async function gerar(): Promise<string> {
  const janela = Float32Array.from({ length: 64 }, (_, i) => Math.sin(i / 3) * 0.3);
  const saida = [percorrer(new Estabilizador(), 1), percorrer(new Estabilizador(432), 2), arredondar(rms(janela)), rms([])];
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(saida)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("detector: caracterização", () => {
  it("a saída é idêntica à gravada antes do refactor", async () => {
    expect(await gerar()).toBe(esperado.trim());
  });
});
