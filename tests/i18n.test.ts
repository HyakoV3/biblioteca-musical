import { describe, expect, it, vi } from "vitest";

// Plurais (`tn`) nos três idiomas, com 0, 1 e 2. No português o Intl trata o 0 como singular ("0 hino"), e a regra do app é "0 hinos": a chave `.zero` conserta isso.
async function i18nEm(idioma: string) {
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: () => idioma, setItem: () => {} });
  vi.stubGlobal("navigator", { language: idioma });
  const { i18n } = await import("../src/lib/i18n/index.svelte");
  return i18n;
}

const ESPERADO = {
  pt: { "plural.hinos": ["0 hinos", "1 hino", "2 hinos"], "plural.partituras": ["0 partituras", "1 partitura", "2 partituras"], "plural.gravacoes": ["0 gravações", "1 gravação", "2 gravações"] },
  en: { "plural.hinos": ["0 hymns", "1 hymn", "2 hymns"], "plural.partituras": ["0 scores", "1 score", "2 scores"], "plural.gravacoes": ["0 recordings", "1 recording", "2 recordings"] },
  es: { "plural.hinos": ["0 himnos", "1 himno", "2 himnos"], "plural.partituras": ["0 partituras", "1 partitura", "2 partituras"], "plural.gravacoes": ["0 grabaciones", "1 grabación", "2 grabaciones"] },
} as const;

describe("tn: 0, 1 e 2 nos três idiomas", () => {
  for (const idioma of ["pt", "en", "es"] as const) {
    it(`${idioma}: hinos, partituras e gravações`, async () => {
      const i18n = await i18nEm(idioma);
      for (const [base, textos] of Object.entries(ESPERADO[idioma])) {
        expect([0, 1, 2].map((n) => i18n.tn(base as "plural.hinos", n))).toEqual(textos);
      }
    });
  }

  it("a confirmação de apagar tudo no singular não diz 'as 1'", async () => {
    expect((await i18nEm("pt")).tn("plural.apagar_todas", 1)).toBe("Apagar mesmo a gravação?");
    expect((await i18nEm("pt")).tn("plural.apagar_todas", 3)).toBe("Apagar mesmo as 3?");
    expect((await i18nEm("en")).tn("plural.apagar_todas", 1)).toBe("Really delete the recording?");
    expect((await i18nEm("es")).tn("plural.apagar_todas", 3)).toBe("¿Borrar de verdad las 3?");
  });
});
