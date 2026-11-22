import { describe, expect, it } from "vitest";
import { LIMITE_JSON_BYTES, LIMITE_ZIP_BYTES, bytesParaBase64, listaCurta } from "../src/lib/pacote";


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

describe("bytesParaBase64 (o zip vai ao Rust como texto: no Android não há corpo binário)", () => {
  const texto = (s: string) => new TextEncoder().encode(s);

  it("os vetores de teste da RFC 4648", () => {
    const casos: [string, string][] = [["", ""], ["f", "Zg=="], ["fo", "Zm8="], ["foo", "Zm9v"], ["foob", "Zm9vYg=="], ["fooba", "Zm9vYmE="], ["foobar", "Zm9vYmFy"]];
    for (const [entrada, esperado] of casos) expect(bytesParaBase64(texto(entrada)), JSON.stringify(entrada)).toBe(esperado);
  });

  it("os 256 valores de byte voltam iguais (nada se perde nos bytes altos nem no zero)", () => {
    const todos = Uint8Array.from({ length: 256 }, (_, i) => i);
    const volta = Uint8Array.from(atob(bytesParaBase64(todos)), (c) => c.charCodeAt(0));
    expect(Array.from(volta)).toEqual(Array.from(todos));
  });

  it("o começo de um zip (PK\\x03\\x04) e bytes de controle", () => {
    expect(bytesParaBase64(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0, 0xff))).toBe("UEsDBAD/");
  });

  it("tamanhos em volta dos pedaços internos (32766 bytes) voltam iguais e sem preenchimento no meio", () => {
    for (const n of [32764, 32765, 32766, 32767, 32768, 65531, 65532, 65533, 100000, 1_000_003]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) & 0xff);
      const b64 = bytesParaBase64(bytes);
      expect(b64.length, `n=${n}`).toBe(Math.ceil(n / 3) * 4);
      expect(b64.slice(0, -2).includes("="), `n=${n}: "=" no meio`).toBe(false);
      const volta = atob(b64);
      expect(volta.length, `n=${n}`).toBe(n);
      let igual = true;
      for (let i = 0; i < n && igual; i++) igual = volta.charCodeAt(i) === bytes[i];
      expect(igual, `n=${n}`).toBe(true);
    }
  });

  it("um arquivo de 15 MB (o pacote de 480 hinos) converte sem estourar a pilha", () => {
    const bytes = new Uint8Array(15 * 1024 * 1024).fill(0xa5);
    const b64 = bytesParaBase64(bytes);
    expect(b64.length).toBe(Math.ceil(bytes.length / 3) * 4);
  });

  it("os limites são os do Rust (150 MiB para o zip de partituras e 20 MiB para o hinario.json)", () => {
    expect(LIMITE_ZIP_BYTES).toBe(150 * 1024 * 1024);
    expect(LIMITE_JSON_BYTES).toBe(20 * 1024 * 1024);
  });
});

describe("a barra única dos pacotes (90% de download, o resto é conferir e instalar)", () => {
  it("o download vai de 0 a 90%; conferir e instalar ficam depois, sem passar de 100%", async () => {
    const { progressoTotal, porcentagemTotal } = await import("../src/lib/pacote");
    expect(progressoTotal("baixando", 0)).toBe(0);
    expect(progressoTotal("baixando", 0.5)).toBeCloseTo(0.45);
    expect(progressoTotal("baixando", 1)).toBeCloseTo(0.9);
    expect(progressoTotal("baixando", 7)).toBeCloseTo(0.9); // valor fora da faixa é cortado
    expect(progressoTotal("conferindo", 1)).toBeGreaterThan(0.9);
    expect(progressoTotal("instalando", 1)).toBeGreaterThan(progressoTotal("conferindo", 1));
    expect(progressoTotal("instalando", 1)).toBeLessThan(1);
    expect(progressoTotal("ocioso", 1)).toBe(0);
    expect(progressoTotal("baixando", NaN)).toBe(0); // total desconhecido: não vira "NaN%"
    expect(progressoTotal("baixando", Infinity)).toBeCloseTo(0.9);
    expect(progressoTotal("conferindo", 1)).toBeCloseTo(0.93);
    expect(progressoTotal("instalando", 1)).toBeCloseTo(0.96);
    expect(porcentagemTotal("baixando", 1)).toBe(90);
  });
});
