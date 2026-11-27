// Caracterização do SuavizadorDeCents: uma sequência longa e determinística de estados (notas, repetidas, congeladas, silêncio, cents inválidos, trocas de nota, relógio parado e voltando)
// passa pelo suavizador, e o hash da saída (em ponto flutuante exato) é comparado com o gravado antes do refactor.
import { describe, expect, it } from "vitest";
import { SuavizadorDeCents } from "../src/lib/suavizador";
import type { Estado } from "../src/lib/detector";
import esperado from "./fixtures/suavizador-caracterizacao.sha256?raw";

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

function estadoAleatorio(r: () => number): Estado {
  const sorteio = r();
  const leitura = { midi: 57 + Math.floor(r() * 3), cents: sorteio < 0.05 ? NaN : (r() - 0.5) * 100 };
  if (sorteio < 0.1) return { tipo: "silencio" };
  if (sorteio < 0.3) return { tipo: "nota", leitura, freq: 440, repetida: true };
  if (sorteio < 0.4) return { tipo: "congelada", leitura, freq: 440, repetida: true };
  return { tipo: "nota", leitura, freq: 440 };
}

function percorrer(suavizador: SuavizadorDeCents, semente: number): unknown[] {
  const r = aleatorio(semente);
  const saida: unknown[] = [];
  let agora = 1000;
  for (let i = 0; i < 4000; i++) {
    const sorteio = r();
    agora += sorteio < 0.03 ? 0 : sorteio < 0.06 ? -20 : sorteio < 0.08 ? NaN : sorteio < 0.1 ? 1e7 : r() * 60;
    saida.push(suavizador.entrar(agora, estadoAleatorio(r)));
  }
  return saida;
}

async function gerar(): Promise<string> {
  const saida = [percorrer(new SuavizadorDeCents(), 1), percorrer(new SuavizadorDeCents(80, 0.5), 2), percorrer(new SuavizadorDeCents(400, 3), 3)];
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(saida)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("suavizador: caracterização", () => {
  it("a saída é idêntica à gravada antes do refactor", async () => {
    expect(await gerar()).toBe(esperado.trim());
  });
});
