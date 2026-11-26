import { describe, expect, it, vi } from "vitest";

// O idioma salvo vem do localStorage, que qualquer coisa pode ter escrito: um nome que existe em `Object.prototype` ("toString", "constructor")
// não é um idioma, e o app tem de abrir no do sistema em vez de quebrar na primeira tradução.
async function idiomaCom(salvo: string | null, sistema = "pt-BR") {
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: () => salvo, setItem: () => {} });
  vi.stubGlobal("navigator", { language: sistema });
  const { i18n } = await import("../src/lib/i18n/index.svelte");
  return i18n;
}

describe("idioma inicial", () => {
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])("o salvo '%s' não é idioma: vale o do sistema", async (nome) => {
    const i18n = await idiomaCom(nome, "en-US");
    expect(i18n.idioma).toBe("en");
    expect(typeof i18n.t("ajustes.conteudo")).toBe("string");
  });

  it("um idioma salvo de verdade vale", async () => {
    expect((await idiomaCom("es")).idioma).toBe("es");
  });
});
