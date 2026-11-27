import { describe, expect, it } from "vitest";
import { escreverOgg, webmParaOgg } from "../src/lib/ogg";
import { lerOpusDoWebm } from "../src/lib/webm";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

// Testes de caracterização: o hash SHA-256 da saída em bytes foi gerado pelo código de antes da refatoração e tem de continuar idêntico.
const sha = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b as BufferSource))].map((x) => x.toString(16).padStart(2, "0")).join("");
const resumo = async (b: Uint8Array) => [b.length, await sha(b)];

/** Pacote Opus determinístico (CELT 20 ms) de `n` bytes com conteúdo variado. */
const pacote = (n: number, semente: number) => {
  const p = new Uint8Array(n).map((_, i) => (i * 31 + semente * 7) & 0xff);
  p[0] = 0b01111000;
  return p;
};

describe("saída em bytes do Ogg", async () => {
  const cab = () => lerOpusDoWebm(bytesDe(OPUS_WEBM))!.cabecalho;

  it("webmParaOgg do opus-0.webm", async () => {
    expect(await resumo(webmParaOgg(bytesDe(OPUS_WEBM))!)).toEqual([2387, "f5b504f36563fec8295e1cd001496d9efe942aca18229c51948295b7baf49e5e"]);
  });

  it("webmParaOgg do opus-ao-vivo.webm", async () => {
    expect(await resumo(webmParaOgg(bytesDe(OPUS_WEBM_AO_VIVO))!)).toEqual([2340, "71ce1cd87d1144f91d3ab5d5bf9c679f2fc2f56bbe2cc9a820bffbd9a02eb57d"]);
  });

  it("pacotes de tamanhos variados (limites do lacing: 254, 255, 256, 510, 1275)", async () => {
    const tamanhos = [10, 254, 255, 256, 510, 1275, 100, 255, 255, 3];
    expect(await resumo(escreverOgg(cab(), tamanhos.map((n, i) => pacote(n, i))))).toEqual([3330, "ef332b49a3a466a55fb65685db1ccd0bba96c7eb311085184af010bd28d4b845"]);
  });

  it("muitos pacotes pequenos (mais de uma página de 50) com DiscardPadding e série própria", async () => {
    const pacotes = Array.from({ length: 130 }, (_, i) => pacote(20 + (i % 9), i));
    expect(await resumo(escreverOgg(cab(), pacotes, 321, 0x12345678))).toEqual([3430, "217db35abdb7ccf4ac983372faa2c941528107418b77281b15948b9090e30148"]);
  });

  it("pacotes grandes: a página fecha pelo limite de 255 valores de lacing", async () => {
    const pacotes = Array.from({ length: 120 }, (_, i) => pacote(1275, i));
    expect(await resumo(escreverOgg(cab(), pacotes))).toEqual([153910, "25344ba67c359ebac99139b82122cf0754c785895987818af09e05c93c1d77c0"]);
  });

  it("DiscardPadding maior que o áudio não passa do pre-skip", async () => {
    expect(await resumo(escreverOgg(cab(), [pacote(30, 1)], 999999))).toEqual([167, "cc16a6fb60560b2e8aed3618e49035d9838a68ac98ca3f87a514b29d9b2b44bb"]);
  });
});
