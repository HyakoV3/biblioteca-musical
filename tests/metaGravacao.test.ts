import { describe, expect, it } from "vitest";
import { TITULO_MAX, limparTitulo, normalizarMeta } from "../src/lib/metaGravacao";
import type { MetaGravacao } from "../src/lib/gravacoes";

describe("limparTitulo", () => {
  it("tira espaços, quebras de linha e controles; colapsa espaços", () => {
    expect(limparTitulo("  Ensaio   do\n coro\t ")).toBe("Ensaio do coro");
    expect(limparTitulo("a\u0000b c")).toBe("a b c");
  });
  it("vazio, só espaços ou não texto: nulo", () => {
    expect(limparTitulo("")).toBeNull();
    expect(limparTitulo("   \n ")).toBeNull();
    expect(limparTitulo(42)).toBeNull();
    expect(limparTitulo(undefined)).toBeNull();
  });
  it("normaliza em NFC (acento separado vira um caractere)", () => {
    expect(limparTitulo("Fé")).toBe("Fé");
  });
  it("recorta por caracteres VISÍVEIS (grafemas): uma família de emoji e uma bandeira contam um", () => {
    expect(Array.from(limparTitulo("a".repeat(200))!)).toHaveLength(TITULO_MAX);
    const familia = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}"; // 7 pontos de código, 1 grafema
    const bandeira = "\u{1F1E7}\u{1F1F7}"; // 2 pontos de código, 1 grafema
    const grafemas = (s: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)).length;
    expect(grafemas(limparTitulo(familia.repeat(TITULO_MAX + 20))!)).toBe(TITULO_MAX);
    expect(grafemas(limparTitulo(bandeira.repeat(TITULO_MAX + 20))!)).toBe(TITULO_MAX);
    expect(limparTitulo("\u{1F3BA}".repeat(TITULO_MAX + 20))!.length).toBeGreaterThan(TITULO_MAX); // pares substitutos: mais unidades UTF-16 que grafemas
  });
  it("só invisíveis, controles C1 e marcas de direção não viram nome", () => {
    expect(limparTitulo("\u200B\u200B")).toBeNull();
    expect(limparTitulo("\u2060 \u3164 \u2800")).toBeNull();
    expect(limparTitulo("\u202E\u2066 \u0085")).toBeNull();
    expect(limparTitulo("a\u0085b")).toBe("a b");
    expect(limparTitulo("a\u202Eb")).toBe("a b");
    expect(limparTitulo("Fé")).toBe("Fé");
  });
});

describe("normalizarMeta", () => {
  const base: MetaGravacao = { id: "a", criadaEm: 1, segundos: 2, tipo: "audio/webm", bytes: 3 };
  it("mantém o que vale e remove o que não vale, sem tocar nos outros campos", () => {
    expect(normalizarMeta({ ...base, titulo: " Nome ", favorita: true })).toEqual({ ...base, titulo: "Nome", favorita: true });
    const ruim = normalizarMeta({ ...base, titulo: 7 as unknown as string, favorita: "sim" as unknown as boolean });
    expect(ruim).toEqual(base);
    expect(ruim).not.toHaveProperty("titulo");
    expect(ruim).not.toHaveProperty("favorita");
    expect(normalizarMeta({ ...base, futuro: "x" } as MetaGravacao)).toHaveProperty("futuro", "x");
  });
});
