import { describe, expect, it } from "vitest";
import { lerOpusDoWebm, opusHeadValido } from "../src/lib/webm";
import { OPUS_WEBM, OPUS_WEBM_AO_VIVO, bytesDe } from "./fixtures/opus";

// Testes de caracterização do leitor de WebM: os resumos foram gerados pelo código de antes da refatoração.

const sha = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b as BufferSource))].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Resumo estável do resultado: cabeçalho, descarte, quantidade e hash de todos os pacotes (com os tamanhos). */
async function resumo(b: Uint8Array) {
  const o = lerOpusDoWebm(b);
  if (!o) return null;
  const todos = new Uint8Array(o.pacotes.reduce((s, p) => s + p.length + 4, 0));
  let i = 0;
  for (const p of o.pacotes) {
    new DataView(todos.buffer).setUint32(i, p.length);
    todos.set(p, i + 4);
    i += p.length + 4;
  }
  return { cabecalho: Array.from(o.cabecalho), descarte: o.descarte, pacotes: o.pacotes.length, hash: await sha(todos) };
}

// Construtor mínimo de EBML para os casos sintéticos.
const idBytes = (id: number) => {
  const r: number[] = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) r.unshift(v & 0xff);
  return r;
};
const tamanho = (n: number) => (n < 127 ? [0x80 | n] : [0x40 | (n >> 8), n & 0xff]);
const el = (id: number, dados: number[] | Uint8Array, desconhecido = false) => [...idBytes(id), ...(desconhecido ? [0xff] : tamanho(dados.length)), ...dados];

const opusHead = (canais = 1) => [...new TextEncoder().encode("OpusHead"), 1, canais, 0x38, 0x01, 0x80, 0xbb, 0, 0, 0, 0, 0];
const faixa = (numero: number, codec: string, privado?: number[]) =>
  el(0xae, [...el(0xd7, [numero]), ...el(0x86, [...new TextEncoder().encode(codec)]), ...(privado ? el(0x63a2, privado) : [])]);
const bloco = (faixaN: number, flags: number, pacote: number[]) => el(0xa3, [0x80 | faixaN, 0, 0, flags, ...pacote]);
const arquivo = (faixas: number[], clusters: number[], desconhecido = false) =>
  new Uint8Array([...el(0x1a45dfa3, []), ...el(0x18538067, [...el(0x1654ae6b, faixas), ...el(0x1f43b675, clusters, desconhecido)], desconhecido)]);

describe("lerOpusDoWebm: arquivos reais", () => {
  it("opus-0.webm", async () => {
    expect(await resumo(bytesDe(OPUS_WEBM))).toEqual(ESPERADO.vivo0);
  });
  it("opus-ao-vivo.webm (tamanhos desconhecidos)", async () => {
    expect(await resumo(bytesDe(OPUS_WEBM_AO_VIVO))).toEqual(ESPERADO.vivo1);
  });
  it("arquivos cortados em vários pontos: usa o que deu para ler", async () => {
    const b = bytesDe(OPUS_WEBM_AO_VIVO);
    const saidas: unknown[] = [];
    for (let n = 0; n <= b.length; n += 97) {
      const r = await resumo(b.subarray(0, n));
      saidas.push(r ? [r.pacotes, r.descarte, r.hash.slice(0, 8)] : null);
    }
    expect(await sha(new TextEncoder().encode(JSON.stringify(saidas)))).toBe(ESPERADO.cortes);
  });
});

describe("lerOpusDoWebm: arquivos sintéticos", () => {
  const cab = opusHead();
  const audio = (...pacotes: number[][]) => pacotes.map((p) => bloco(1, 0, p)).flat();

  it("um pacote por bloco, em ordem", async () => {
    const r = lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), el(0xe7, [0]).concat(audio([1, 2], [3], [4, 5, 6]))))!;
    expect(Array.from(r.cabecalho)).toEqual(cab);
    expect(r.pacotes.map((p) => Array.from(p))).toEqual([[1, 2], [3], [4, 5, 6]]);
    expect(r.descarte).toBe(0);
  });
  it("BlockGroup e DiscardPadding (inteiro com sinal, nanossegundos)", async () => {
    const grupo = el(0xa0, [...el(0xa1, [0x81, 0, 0, 0, 9, 9]), ...el(0x75a2, [0x0b, 0x71, 0xb0])]); // 750000 ns = 36 amostras
    const r = lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), [...audio([7]), ...grupo]))!;
    expect(r.pacotes.map((p) => Array.from(p))).toEqual([[7], [9, 9]]);
    expect(r.descarte).toBe(36);
    const neg = lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), [...audio([7]), ...el(0x75a2, [0xff, 0xf0, 0x00])]))!;
    expect(neg.descarte).toBe(0);
  });
  it("só usa a faixa Opus: pula blocos de outra faixa e outros codecs", async () => {
    const faixas = [...faixa(1, "A_VORBIS", [5, 5]), ...faixa(2, "A_OPUS", cab)];
    const r = lerOpusDoWebm(arquivo(faixas, [...bloco(1, 0, [1]), ...bloco(2, 0, [2, 2]), ...bloco(1, 0, [3]), ...bloco(2, 0, [4])]))!;
    expect(r.pacotes.map((p) => Array.from(p))).toEqual([[2, 2], [4]]);
  });
  it("tamanhos desconhecidos nos mestres (ao vivo)", async () => {
    const r = lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), audio([1], [2]), true))!;
    expect(r.pacotes).toHaveLength(2);
  });
  it("devolve null: lacing, sem faixa Opus, sem pacotes, OpusHead inválido, tamanho desconhecido fora de mestre, bloco curto", async () => {
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), bloco(1, 0x02, [1])))).toBeNull();
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_VORBIS", [1]), audio([1])))).toBeNull();
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), []))).toBeNull();
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", [1, 2, 3]), audio([1])))).toBeNull();
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), el(0xec, [1], true)))).toBeNull();
    expect(lerOpusDoWebm(arquivo(faixa(1, "A_OPUS", cab), el(0xa3, [0x81, 0])))).toBeNull();
    expect(lerOpusDoWebm(new Uint8Array([]))).toBeNull();
    expect(lerOpusDoWebm(new Uint8Array([0, 1, 2]))).toBeNull();
  });
  it("bloco cortado no fim do arquivo é ignorado", async () => {
    const b = arquivo(faixa(1, "A_OPUS", cab), audio([1], [2, 2, 2]));
    const r = lerOpusDoWebm(b.subarray(0, b.length - 2))!;
    expect(r.pacotes.map((p) => Array.from(p))).toEqual([[1]]);
  });
  it("opusHeadValido", async () => {
    expect(opusHeadValido(new Uint8Array(cab))).toBe(true);
    expect(opusHeadValido(new Uint8Array(cab.slice(0, 18)))).toBe(false);
    expect(opusHeadValido(new Uint8Array(cab.map((x, i) => (i === 8 ? 0x10 : x))))).toBe(false);
    expect(opusHeadValido(new Uint8Array(cab.map((x, i) => (i === 9 ? 0 : x))))).toBe(false);
    const mapeado = [...cab, 0, 0];
    mapeado[18] = 1;
    expect(opusHeadValido(new Uint8Array(mapeado))).toBe(false);
    expect(opusHeadValido(new Uint8Array([...mapeado, 0, 0, 0]))).toBe(true);
  });
});

const CABECALHO = [79, 112, 117, 115, 72, 101, 97, 100, 1, 1, 56, 1, 128, 187, 0, 0, 0, 0, 0];
const ESPERADO = {
  vivo0: { cabecalho: CABECALHO, descarte: 648, pacotes: 26, hash: "32e727a94725656574d5cbc76d2cd3fbc4b4116ddba320299e947f85ef9078e4" },
  vivo1: { cabecalho: CABECALHO, descarte: 648, pacotes: 26, hash: "51a5aeab179af61be07b7db564195fc38b1ee51590e54a1277b954a81fa48e95" },
  cortes: "7fe9e477a9e645dd317113e453f54073f7f3813d1b4b721106d5f74ef3ea3c65",
};
