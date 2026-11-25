import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAVE_INSTRUMENTO, ehInstrumento, lerInstrumento, salvarInstrumento } from "../src/lib/afinadorPrefs";

function armazenamento(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

describe("instrumento do 'Qual nota é essa?'", () => {
  it("sem nada guardado ou com lixo, é concerto (a nota que soa)", () => {
    armazenamento();
    expect(lerInstrumento()).toBe("concerto");
    armazenamento({ [CHAVE_INSTRUMENTO]: "trompete" });
    expect(lerInstrumento()).toBe("concerto");
  });
  it("lembra o que foi escolhido", () => {
    const m = armazenamento();
    salvarInstrumento("si_bemol");
    expect(m.get(CHAVE_INSTRUMENTO)).toBe("si_bemol");
    expect(lerInstrumento()).toBe("si_bemol");
  });
  it("sem armazenamento, não quebra", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } });
    expect(lerInstrumento()).toBe("concerto");
    expect(() => salvarInstrumento("fa")).not.toThrow();
  });
  it("só os quatro instrumentos valem", () => {
    expect(["concerto", "si_bemol", "mi_bemol", "fa"].every(ehInstrumento)).toBe(true);
    expect(ehInstrumento("tuba")).toBe(false);
  });
});
