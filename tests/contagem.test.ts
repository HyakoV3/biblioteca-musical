import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Contagem, LIMITES, segundosRestantes } from "../src/lib/contagem";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Uma contagem com os avisos gravados, para o teste ler o que a tela veria. */
function nova() {
  const vistos: (number | null)[] = [];
  let terminou = 0;
  const c = new Contagem(
    (r) => vistos.push(r),
    () => terminou++,
  );
  return { c, vistos, terminou: () => terminou, ultimo: () => vistos.at(-1) };
}

describe("opções de tempo", () => {
  it("até parar (0), 10, 20 e 30 segundos, nesta ordem", () => {
    expect([...LIMITES]).toEqual([0, 10, 20, 30]);
  });
});

describe("segundosRestantes", () => {
  it("arredonda para cima e nunca é negativo", () => {
    expect(segundosRestantes(10_000, 0)).toBe(10);
    expect(segundosRestantes(10_000, 100)).toBe(10); // 9,9 s ainda mostra 10
    expect(segundosRestantes(10_000, 9_001)).toBe(1); // 0,999 s mostra 1, não 0
    expect(segundosRestantes(10_000, 10_000)).toBe(0);
    expect(segundosRestantes(10_000, 12_000)).toBe(0); // passou do fim
  });
});

describe("Contagem", () => {
  it("conta de cima para baixo, avisa o fim uma única vez e fica sem contagem", () => {
    const { c, vistos, terminou, ultimo } = nova();
    c.iniciar(10);
    expect(vistos[0]).toBe(10);
    expect(c.ativa).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(ultimo()).toBe(7);
    vi.advanceTimersByTime(6_500);
    expect(ultimo()).toBe(1); // 9,5 s: falta meio segundo, mostra 1
    expect(terminou()).toBe(0);
    vi.advanceTimersByTime(600);
    expect(terminou()).toBe(1);
    expect(ultimo()).toBeNull();
    expect(c.ativa).toBe(false);
    vi.advanceTimersByTime(30_000);
    expect(terminou()).toBe(1); // não repete
    expect(vi.getTimerCount()).toBe(0); // e não sobra relógio rodando
  });

  it("os números mostrados só descem, sem pular nenhum segundo", () => {
    const { c, vistos } = nova();
    c.iniciar(5);
    vi.advanceTimersByTime(5_200);
    const numeros = vistos.filter((v): v is number => v !== null);
    for (let i = 1; i < numeros.length; i++) expect(numeros[i], `${numeros}`).toBeLessThanOrEqual(numeros[i - 1]);
    expect([...new Set(numeros)]).toEqual([5, 4, 3, 2, 1]);
  });

  it("cancelar no meio: não termina nunca e avisa que não há contagem", () => {
    const { c, terminou, ultimo } = nova();
    c.iniciar(10);
    vi.advanceTimersByTime(4_000);
    c.cancelar();
    expect(ultimo()).toBeNull();
    vi.advanceTimersByTime(30_000);
    expect(terminou()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("iniciar de novo REINICIA a partir de agora (trocar de nota recomeça a contagem), sem um 'sem contagem' no meio", () => {
    const { c, vistos, terminou, ultimo } = nova();
    c.iniciar(10);
    vi.advanceTimersByTime(6_000);
    expect(ultimo()).toBe(4);
    const antes = vistos.length;
    c.iniciar(10); // outra nota
    expect(vistos.slice(antes)).toEqual([10]); // direto para 10, sem passar por null
    expect(ultimo()).toBe(10);
    vi.advanceTimersByTime(1_000);
    expect(ultimo()).toBe(9);
    vi.advanceTimersByTime(6_000); // 7 s depois do reinício: sem reiniciar, já teria terminado aos 10 s
    expect(terminou()).toBe(0);
    vi.advanceTimersByTime(3_100);
    expect(terminou()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("mudar o tempo com a contagem rodando vale a partir de agora", () => {
    const { c, terminou, ultimo } = nova();
    c.iniciar(30);
    vi.advanceTimersByTime(8_000);
    c.iniciar(10);
    expect(ultimo()).toBe(10);
    vi.advanceTimersByTime(10_100);
    expect(terminou()).toBe(1);
  });

  it("zero é 'até parar': não conta, não termina e cancela a contagem que existia", () => {
    const { c, vistos, terminou } = nova();
    c.iniciar(0);
    expect(vistos.filter((v) => v !== null)).toEqual([]);
    expect(c.ativa).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    c.iniciar(10);
    vi.advanceTimersByTime(2_000);
    c.iniciar(0); // a pessoa voltou para "até parar" com o tom soando
    vi.advanceTimersByTime(60_000);
    expect(terminou()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("valor inválido (negativo, NaN, infinito) não conta", () => {
    for (const ruim of [-5, NaN, Infinity, -Infinity]) {
      const { c, terminou } = nova();
      c.iniciar(ruim);
      expect(c.ativa, String(ruim)).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(terminou(), String(ruim)).toBe(0);
    }
  });

  it("cancelar sem contagem não quebra", () => {
    const { c, ultimo } = nova();
    expect(() => c.cancelar()).not.toThrow();
    expect(ultimo()).toBeNull();
  });
});
