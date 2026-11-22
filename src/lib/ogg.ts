// Escreve um arquivo Ogg/Opus (RFC 7845) a partir dos pacotes Opus: é um "remux", o áudio não é recodificado. Páginas com CRC (RFC 3533),
// `OpusHead` e `OpusTags` cada um na sua página, granule position em amostras a 48 kHz contando o pre-skip.
import { lerOpusDoWebm, opusHeadValido } from "./webm";

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 do Ogg: polinômio 0x04C11DB7, valor inicial 0, sem inversão de bits nem XOR final. */
export function crcOgg(b: Uint8Array): number {
  let c = 0;
  for (const x of b) c = ((c << 8) ^ TABELA_CRC[((c >>> 24) ^ x) & 0xff]!) >>> 0;
  return c;
}

/** Duração de um pacote Opus em amostras a 48 kHz, pelo byte TOC (RFC 6716 §3.1). 0 se o pacote for inválido. */
export function amostrasDoPacote(p: Uint8Array): number {
  if (p.length === 0) return 0;
  const toc = p[0]!;
  const cfg = toc >> 3;
  const quadro = cfg < 12 ? [480, 960, 1920, 2880][cfg % 4]! : cfg < 16 ? [480, 960][cfg % 2]! : [120, 240, 480, 960][cfg % 4]!;
  const c = toc & 3;
  const n = c === 0 ? 1 : c < 3 ? 2 : p.length > 1 ? p[1]! & 0x3f : 0;
  return n === 0 || n * quadro > 5760 ? 0 : n * quadro; // até 120 ms por pacote (RFC 6716 §3.2.5)
}

const PACOTES_POR_PAGINA = 50;
const SEGMENTOS_POR_PAGINA = 255;
/** Quantos valores de lacing o pacote usa. */
const segmentosDe = (p: Uint8Array) => Math.floor(p.length / 255) + 1;

function pagina(tipo: number, granule: number, serie: number, seq: number, pacotes: Uint8Array[]): Uint8Array {
  const segs: number[] = [];
  for (const p of pacotes) {
    for (let r = p.length; r >= 255; r -= 255) segs.push(255);
    segs.push(p.length % 255);
  }
  if (segs.length > 255) throw new Error("pacote grande demais para uma página");
  const corpo = pacotes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(27 + segs.length + corpo);
  const v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, tipo], 0);
  v.setUint32(6, granule % 0x100000000, true);
  v.setUint32(10, Math.floor(granule / 0x100000000), true);
  v.setUint32(14, serie, true);
  v.setUint32(18, seq, true);
  out[26] = segs.length;
  out.set(segs, 27);
  let o = 27 + segs.length;
  for (const p of pacotes) {
    out.set(p, o);
    o += p.length;
  }
  v.setUint32(22, crcOgg(out), true); // o campo do CRC está zerado até aqui
  return out;
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("Biblioteca Musical");
  const t = new Uint8Array(8 + 4 + vendor.length + 4);
  t.set(new TextEncoder().encode("OpusTags"), 0);
  const v = new DataView(t.buffer);
  v.setUint32(8, vendor.length, true);
  t.set(vendor, 12);
  return t;
}

/** Monta o Ogg/Opus com o cabeçalho `OpusHead` e os pacotes. `serie` é o número do fluxo (qualquer um serve). */
export function escreverOgg(cabecalho: Uint8Array, pacotes: Uint8Array[], descarte = 0, serie = 0x42494d55): Uint8Array {
  if (!opusHeadValido(cabecalho)) throw new Error("OpusHead inválido");
  if (pacotes.length === 0) throw new Error("sem pacotes");
  const duracoes = pacotes.map(amostrasDoPacote);
  if (duracoes.includes(0)) throw new Error("pacote Opus inválido");
  const preSkip = new DataView(cabecalho.buffer, cabecalho.byteOffset, cabecalho.byteLength).getUint16(10, true);
  const partes: Uint8Array[] = [pagina(0x02, 0, serie, 0, [cabecalho]), pagina(0, 0, serie, 1, [opusTags()])];
  let seq = 2;
  let amostras = preSkip;
  let i = 0;
  while (i < pacotes.length) {
    // Uma página leva até 50 pacotes e 255 valores de lacing; um pacote grande (alto bitrate) enche a página com menos.
    let segs = 0;
    let fim = i;
    while (fim < pacotes.length && fim - i < PACOTES_POR_PAGINA && segs + segmentosDe(pacotes[fim]!) <= SEGMENTOS_POR_PAGINA) segs += segmentosDe(pacotes[fim++]!);
    if (fim === i) throw new Error("pacote grande demais para uma página");
    for (let k = i; k < fim; k++) amostras += duracoes[k]!;
    const ultima = fim >= pacotes.length;
    // O fim da última página desconta o DiscardPadding do WebM (o resto do último quadro, que não é áudio).
    partes.push(pagina(ultima ? 0x04 : 0, ultima ? Math.max(preSkip, amostras - descarte) : amostras, serie, seq++, pacotes.slice(i, fim)));
    i = fim;
  }
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** WebM com Opus → Ogg com Opus, sem recodificar. `null` quando o arquivo não é um WebM/Opus que se consiga ler ou o remux falha. */
export function webmParaOgg(webm: Uint8Array): Uint8Array | null {
  try {
    const o = lerOpusDoWebm(webm);
    return o ? escreverOgg(o.cabecalho, o.pacotes, o.descarte) : null;
  } catch (e) {
    console.warn("ogg: o remux falhou", e);
    return null;
  }
}
