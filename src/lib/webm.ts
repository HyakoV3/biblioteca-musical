// Leitor mínimo de WebM/Matroska só para áudio Opus: acha o cabeçalho `OpusHead` (CodecPrivate) e a lista de pacotes. É o que o remux para Ogg precisa (docs/ideia-enviar-audio-por-app.md).
// Os elementos "mestre" (Segment, Tracks, TrackEntry, Cluster, BlockGroup) são percorridos por dentro, sem usar o tamanho: assim o tamanho desconhecido
// (que o MediaRecorder do Chrome escreve ao gravar ao vivo) não atrapalha. Os demais são pulados pelo tamanho. Arquivo cortado no fim: usa o que deu para ler.

/** `descarte`: amostras (48 kHz) do fim do último bloco que não são áudio (DiscardPadding). */
export type OpusEmWebm = { cabecalho: Uint8Array; pacotes: Uint8Array[]; descarte: number };

const MESTRES = new Set([0x18538067, 0x1654ae6b, 0xae, 0x1f43b675, 0xa0]);
const ID = { codec: 0x86, privado: 0x63a2, numero: 0xd7, bloco: 0xa3, blocoGrupo: 0xa1, descarte: 0x75a2 };

/** Lê um ID (1 a 4 bytes, com os bits de tamanho mantidos). */
function lerId(b: Uint8Array, i: number): { v: number; n: number } | null {
  const p = b[i];
  if (p === undefined || p === 0) return null;
  const n = Math.clz32(p) - 23; // 1 a 4
  if (n > 4 || i + n > b.length) return null;
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[i + k]!;
  return { v, n };
}

/** Lê um tamanho (1 a 8 bytes, sem o marcador). `v` é -1 quando o tamanho é desconhecido (todos os bits em 1). */
function lerTamanho(b: Uint8Array, i: number): { v: number; n: number } | null {
  const p = b[i];
  if (p === undefined || p === 0) return null;
  const n = Math.clz32(p) - 23;
  if (i + n > b.length) return null;
  let v = p & (0xff >> n);
  let tudoUm = v === 0xff >> n;
  for (let k = 1; k < n; k++) {
    const c = b[i + k]!;
    if (c !== 0xff) tudoUm = false;
    v = v * 256 + c;
  }
  return { v: tudoUm ? -1 : v, n };
}

/** Texto curto (CodecID, "OpusHead"): sem o preenchimento de zeros do fim e sem passar dos 64 bytes (um elemento enorme não estoura a pilha). */
const texto = (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 64)).replace(/\0+$/, "");

/** Devolve o Opus do WebM, ou `null` se não for WebM com áudio Opus (ou se usar "lacing", que o Chrome não usa). */
export function lerOpusDoWebm(b: Uint8Array): OpusEmWebm | null {
  let i = 0;
  let faixaOpus = -1;
  let faixaAtual = -1;
  let codecAtual = "";
  let privado: Uint8Array | null = null;
  const pacotes: Uint8Array[] = [];
  let descarte = 0;
  let cabecalho: Uint8Array | null = null;

  const fechaFaixa = () => {
    if (codecAtual === "A_OPUS" && faixaOpus < 0 && faixaAtual >= 0) {
      faixaOpus = faixaAtual;
      cabecalho = privado;
    }
    faixaAtual = -1;
    codecAtual = "";
    privado = null;
  };

  while (i < b.length) {
    const id = lerId(b, i);
    if (!id) break;
    const tam = lerTamanho(b, i + id.n);
    if (!tam) break;
    const ini = i + id.n + tam.n;
    if (MESTRES.has(id.v)) {
      if (id.v === 0xae) fechaFaixa(); // um TrackEntry novo fecha o anterior
      i = ini;
      continue;
    }
    if (tam.v < 0) return null; // tamanho desconhecido num elemento que não é mestre: não é um arquivo que se entenda
    const fim = Math.min(ini + tam.v, b.length);
    const dados = b.subarray(ini, fim);
    if (id.v === ID.codec) codecAtual = texto(dados);
    else if (id.v === ID.privado) privado = dados;
    else if (id.v === ID.descarte && dados.length > 0 && dados.length <= 6) {
      // inteiro com sinal, em nanossegundos: o fim do último bloco que o player deve ignorar
      let n = dados[0]! & 0x80 ? -1 : 0;
      for (const c of dados) n = n * 256 + c;
      descarte = Math.max(0, Math.round((n * 48) / 1000000));
    } else if (id.v === ID.numero) {
      let n = 0;
      for (const c of dados) n = n * 256 + c;
      faixaAtual = n;
    } else if (id.v === ID.bloco || id.v === ID.blocoGrupo) {
      fechaFaixa();
      if (faixaOpus < 0) return null;
      const num = lerTamanho(dados, 0);
      if (!num || dados.length < num.n + 3) return null;
      if (num.v !== faixaOpus) {
        i = fim;
        continue;
      }
      if (dados[num.n + 2]! & 0x06) return null; // lacing na faixa Opus: não tratado
      if (fim - ini === tam.v) pacotes.push(dados.subarray(num.n + 3));
    }
    i = fim;
  }
  fechaFaixa();
  if (!cabecalho || pacotes.length === 0) return null;
  const c: Uint8Array = cabecalho;
  if (!opusHeadValido(c)) return null;
  return { cabecalho: c, pacotes, descarte };
}

/** `OpusHead` (RFC 7845 §5.1): versão 0, ao menos 1 canal e, se o mapeamento não for o 0, a tabela de canais inteira. */
export function opusHeadValido(c: Uint8Array): boolean {
  if (c.length < 19 || String.fromCharCode(...c.subarray(0, 8)) !== "OpusHead") return false;
  if ((c[8]! >> 4) !== 0 || c[9] === 0) return false;
  return c[18] === 0 || c.length >= 21 + c[9]!;
}
