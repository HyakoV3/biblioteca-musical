// Leitor mínimo de WebM/Matroska só para áudio Opus: acha o cabeçalho `OpusHead` (CodecPrivate) e a lista de pacotes. É o que o remux para Ogg precisa (docs/ideia-enviar-audio-por-app.md).
// Os elementos "mestre" (Segment, Tracks, TrackEntry, Cluster, BlockGroup) são percorridos por dentro, sem usar o tamanho: assim o tamanho desconhecido
// (que o MediaRecorder do Chrome escreve ao gravar ao vivo) não atrapalha. Os demais são pulados pelo tamanho. Arquivo cortado no fim: usa o que deu para ler.

/** `descarte`: amostras (48 kHz) do fim do último bloco que não são áudio (DiscardPadding). */
export type OpusEmWebm = { cabecalho: Uint8Array; pacotes: Uint8Array[]; descarte: number };

const MESTRES = new Set([0x18538067, 0x1654ae6b, 0xae, 0x1f43b675, 0xa0]);
const ID = { codec: 0x86, privado: 0x63a2, numero: 0xd7, bloco: 0xa3, blocoGrupo: 0xa1, descarte: 0x75a2, trilha: 0xae };

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

/** Soma os bytes como inteiro big-endian, a partir de `n` (o sinal, no caso dos inteiros com sinal). */
function acumular(dados: Uint8Array, n: number): number {
  for (const c of dados) n = n * 256 + c;
  return n;
}

/** Tudo o que a leitura vai juntando: a faixa que está sendo lida, a faixa Opus escolhida e o que se achou nela. */
type Estado = {
  faixaOpus: number;
  faixaAtual: number;
  codecAtual: string;
  privado: Uint8Array | null;
  cabecalho: Uint8Array | null;
  pacotes: Uint8Array[];
  descarte: number;
};

const novoEstado = (): Estado => ({ faixaOpus: -1, faixaAtual: -1, codecAtual: "", privado: null, cabecalho: null, pacotes: [], descarte: 0 });

/** Fecha a faixa que estava sendo lida: se for a primeira de Opus, ela vira a faixa escolhida e o CodecPrivate dela, o cabeçalho. */
function fechaFaixa(e: Estado): void {
  if (e.codecAtual === "A_OPUS" && e.faixaOpus < 0 && e.faixaAtual >= 0) {
    e.faixaOpus = e.faixaAtual;
    e.cabecalho = e.privado;
  }
  e.faixaAtual = -1;
  e.codecAtual = "";
  e.privado = null;
}

/** Trata um elemento "folha". Devolve `false` quando o arquivo não é um que se entenda (a leitura toda vira `null`). `inteiro`: o elemento não foi cortado no fim do arquivo. */
type Tratador = (e: Estado, dados: Uint8Array, inteiro: boolean) => boolean;

/** DiscardPadding: inteiro com sinal, em nanossegundos: o fim do último bloco que o player deve ignorar. */
const tratarDescarte: Tratador = (e, dados) => {
  if (dados.length === 0 || dados.length > 6) return true;
  const n = acumular(dados, dados[0]! & 0x80 ? -1 : 0);
  e.descarte = Math.max(0, Math.round((n * 48) / 1000000));
  return true;
};

/** SimpleBlock/Block: número da faixa, 2 bytes de tempo, flags e o pacote. Só guarda o da faixa Opus. */
const tratarBloco: Tratador = (e, dados, inteiro) => {
  fechaFaixa(e);
  if (e.faixaOpus < 0) return false;
  const num = lerTamanho(dados, 0);
  if (!num || dados.length < num.n + 3) return false;
  if (num.v !== e.faixaOpus) return true;
  if (dados[num.n + 2]! & 0x06) return false; // lacing na faixa Opus: não tratado
  if (inteiro) e.pacotes.push(dados.subarray(num.n + 3));
  return true;
};

const TRATADORES = new Map<number, Tratador>([
  [ID.codec, (e, dados) => ((e.codecAtual = texto(dados)), true)],
  [ID.privado, (e, dados) => ((e.privado = dados), true)],
  [ID.descarte, tratarDescarte],
  [ID.numero, (e, dados) => ((e.faixaAtual = acumular(dados, 0)), true)],
  [ID.bloco, tratarBloco],
  [ID.blocoGrupo, tratarBloco],
]);

const FIM = -1;
const INVALIDO = -2;

/** Lê o elemento que começa em `i`: devolve onde começa o próximo, `FIM` se não dá para ler mais ou `INVALIDO`. */
function lerElemento(b: Uint8Array, i: number, e: Estado): number {
  const id = lerId(b, i);
  const tam = id && lerTamanho(b, i + id.n);
  if (!id || !tam) return FIM;
  const ini = i + id.n + tam.n;
  if (MESTRES.has(id.v)) {
    if (id.v === ID.trilha) fechaFaixa(e); // um TrackEntry novo fecha o anterior
    return ini;
  }
  if (tam.v < 0) return INVALIDO; // tamanho desconhecido num elemento que não é mestre: não é um arquivo que se entenda
  const fim = Math.min(ini + tam.v, b.length);
  return TRATADORES.get(id.v)?.(e, b.subarray(ini, fim), fim - ini === tam.v) === false ? INVALIDO : fim;
}

/** Devolve o Opus do WebM, ou `null` se não for WebM com áudio Opus (ou se usar "lacing", que o Chrome não usa). */
export function lerOpusDoWebm(b: Uint8Array): OpusEmWebm | null {
  const e = novoEstado();
  for (let i = 0; i < b.length; ) {
    i = lerElemento(b, i, e);
    if (i === INVALIDO) return null;
    if (i === FIM) break;
  }
  fechaFaixa(e);
  if (!e.cabecalho || e.pacotes.length === 0 || !opusHeadValido(e.cabecalho)) return null;
  return { cabecalho: e.cabecalho, pacotes: e.pacotes, descarte: e.descarte };
}

/** `OpusHead` (RFC 7845 §5.1): versão 0, ao menos 1 canal e, se o mapeamento não for o 0, a tabela de canais inteira. */
export function opusHeadValido(c: Uint8Array): boolean {
  if (c.length < 19 || String.fromCharCode(...c.subarray(0, 8)) !== "OpusHead") return false;
  if ((c[8]! >> 4) !== 0 || c[9] === 0) return false;
  return c[18] === 0 || c.length >= 21 + c[9]!;
}
