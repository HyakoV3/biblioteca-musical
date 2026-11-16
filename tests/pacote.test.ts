import { describe, expect, it } from "vitest";
import { ehZip, listaCurta } from "../src/lib/pacote";

const b = (...v: number[]) => new Uint8Array(v);

describe("listaCurta", () => {
  it("mostra todos até o máximo e corta com reticências depois dele", () => {
    expect(listaCurta([])).toBe("");
    expect(listaCurta([5])).toBe("5");
    expect(listaCurta([1, 5, 283])).toBe("1, 5, 283");
    expect(listaCurta([1, 2, 3], 3)).toBe("1, 2, 3");
    expect(listaCurta([1, 2, 3, 4], 3)).toBe("1, 2, 3…");
    expect(listaCurta(Array.from({ length: 300 }, (_, i) => i + 1))).toBe("1, 2, 3, 4, 5, 6, 7, 8…");
  });
});

describe("ehZip", () => {
  it("reconhece zip com arquivos e zip vazio", () => {
    expect(ehZip(b(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00))).toBe(true);
    expect(ehZip(b(0x50, 0x4b, 0x05, 0x06))).toBe(true);
  });

  it("não confunde JSON, texto, vazio nem cabeçalhos quase certos com zip", () => {
    const texto = (s: string) => new TextEncoder().encode(s);
    for (const bytes of [
      texto('{"versao":1}'),
      texto("PK"),
      texto("pk\x03\x04"),
      b(),
      b(0x50),
      b(0x50, 0x4b),
      b(0x50, 0x4b, 0x03),
      b(0x50, 0x4b, 0x07, 0x08), // PK, mas não é início de zip
      b(0x4b, 0x50, 0x03, 0x04),
      b(0xef, 0xbb, 0xbf, 0x7b), // JSON com BOM
    ]) {
      expect(ehZip(bytes), Array.from(bytes).join(",")).toBe(false);
    }
  });
});
