import { describe, expect, it } from "vitest";
import { amostrasDoPacote, crcOgg, escreverOgg, webmParaOgg } from "../src/lib/ogg";
import { lerOpusDoWebm } from "../src/lib/webm";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

const fixture = (n: string) => bytesDe(n === "opus-0.webm" ? OPUS_WEBM : OPUS_WEBM_AO_VIVO);
const texto = (b: Uint8Array) => String.fromCharCode(...b);

/** Percorre as páginas Ogg conferindo o CRC de cada uma. */
function paginas(b: Uint8Array) {
  const out: { tipo: number; granule: number; seq: number; pacotes: number; crcOk: boolean }[] = [];
  let i = 0;
  while (i < b.length) {
    expect(texto(b.subarray(i, i + 4))).toBe("OggS");
    const n = b[i + 26]!;
    let corpo = 0;
    for (let k = 0; k < n; k++) corpo += b[i + 27 + k]!;
    const total = 27 + n + corpo;
    const v = new DataView(b.buffer, b.byteOffset + i, total);
    const copia = b.slice(i, i + total);
    new DataView(copia.buffer).setUint32(22, 0, true);
    out.push({ tipo: b[i + 5]!, granule: v.getUint32(6, true) + v.getUint32(10, true) * 2 ** 32, seq: v.getUint32(18, true), pacotes: b.subarray(i + 27, i + 27 + n).filter((x) => x < 255).length, crcOk: crcOgg(copia) === v.getUint32(22, true) });
    i += total;
  }
  return out;
}

describe("crcOgg", () => {
  it("bate com o valor conhecido do CRC do Ogg (CRC-32/MPEG-2 sem inversões, de '123456789' = 0x89A1897F)", () => {
    expect(crcOgg(new TextEncoder().encode("123456789"))).toBe(0x89a1897f);
  });
});

describe("amostrasDoPacote", () => {
  it("lê a duração do byte TOC", () => {
    expect(amostrasDoPacote(new Uint8Array([0b01111000]))).toBe(960); // CELT 20 ms, 1 quadro
    expect(amostrasDoPacote(new Uint8Array([0b01111001]))).toBe(1920); // 2 quadros
    expect(amostrasDoPacote(new Uint8Array([0b01111011, 3]))).toBe(2880); // código 3, 3 quadros
    expect(amostrasDoPacote(new Uint8Array([0b00000000]))).toBe(480); // SILK 10 ms
    expect(amostrasDoPacote(new Uint8Array([]))).toBe(0);
  });
});

describe.each(["opus-0.webm", "opus-ao-vivo.webm"])("WebM → Ogg (%s)", (nome) => {
  it("lê o Opus: OpusHead mono 48 kHz e os pacotes", () => {
    const o = lerOpusDoWebm(fixture(nome))!;
    expect(texto(o.cabecalho.subarray(0, 8))).toBe("OpusHead");
    expect(o.cabecalho[9]).toBe(1); // canais
    expect(o.pacotes.length).toBeGreaterThan(20);
  });
  it("escreve um Ogg válido: páginas em ordem, CRC certo, granule = pre-skip + amostras, fim marcado", () => {
    const webm = fixture(nome);
    const o = lerOpusDoWebm(webm)!;
    const ogg = webmParaOgg(webm)!;
    const p = paginas(ogg);
    expect(p.every((x) => x.crcOk)).toBe(true);
    expect(p.map((x) => x.seq)).toEqual(p.map((_, i) => i));
    expect(p[0]!.tipo).toBe(0x02);
    expect(p[p.length - 1]!.tipo).toBe(0x04);
    expect(texto(ogg.subarray(28, 36))).toBe("OpusHead");
    const preSkip = new DataView(o.cabecalho.buffer, o.cabecalho.byteOffset).getUint16(10, true);
    const amostras = o.pacotes.reduce((s, x) => s + amostrasDoPacote(x), 0);
    expect(p[p.length - 1]!.granule).toBe(preSkip + amostras);
    // todos os pacotes estão lá (2 páginas de cabeçalho + os de áudio)
    expect(p.slice(2).reduce((s, x) => s + x.pacotes, 0)).toBe(o.pacotes.length);
  });
});

describe("casos de erro", () => {
  it("não é WebM: devolve null", () => {
    expect(webmParaOgg(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(webmParaOgg(new Uint8Array([]))).toBeNull();
  });
  it("arquivo cortado no meio: usa o que deu para ler", () => {
    const webm = fixture("opus-ao-vivo.webm");
    const cheio = lerOpusDoWebm(webm)!.pacotes.length;
    const cortado = lerOpusDoWebm(webm.subarray(0, webm.length - 300))!;
    expect(cortado.pacotes.length).toBeGreaterThan(0);
    expect(cortado.pacotes.length).toBeLessThan(cheio);
  });
  it("pacote enorme demais para uma página: erro (quem chama usa o original)", () => {
    const cab = lerOpusDoWebm(fixture("opus-0.webm"))!.cabecalho;
    expect(() => escreverOgg(cab, [new Uint8Array(70000)])).toThrow();
  });
});
