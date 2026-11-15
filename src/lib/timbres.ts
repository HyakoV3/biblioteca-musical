// Timbre por altura dos instrumentos sintetizados que usam medidas de gravações reais (I-15).
//
// Um instrumento real não tem UM espectro: o mesmo trompete tem o som cheio de harmônicos no grave e quase uma senoide
// no agudo. A tabela fixa de `INSTRUMENTOS` não reproduz isso. Aqui a tabela de harmônicos vem de `timbres.json`
// (medida por tools/analisar-timbres.py nas amostras do FluidR3_GM, MIT): uma tabela a cada 3 semitons, e a de uma
// nota qualquer é a interpolação das duas âncoras vizinhas. Sem medida (outros instrumentos), vale a tabela fixa.
//
// Funções puras e sem Web Audio: servem ao sintetizador do app e às prévias geradas offline.
import medidas from "./timbres.json";
import { INSTRUMENTOS, type Perfil, type SinteticoId } from "./instrumentos";

type Ancora = { midi: number; h: number[]; ataque: number; fc_inicio: number | null; abertura: number | null };
type Medida = { faixa: [number, number]; ancoras: Ancora[] };
const MEDIDAS = medidas.instrumentos as unknown as Record<string, Medida>;

/** O timbre de uma nota: o `Perfil` do instrumento com a tabela, o ataque e o nível próprios daquela altura. */
export type PerfilDaNota = Perfil & {
  /** Metais: o som começa mais escuro e abre. Filtro passa-baixa com corte inicial `corte` (em múltiplos da frequência da nota) que sobe em `tempo` segundos. */
  abertura?: { corte: number; tempo: number };
};

/** Instrumentos com timbre medido. */
export const COM_TIMBRE_MEDIDO = Object.keys(MEDIDAS) as SinteticoId[];
export const temTimbreMedido = (id: string): id is SinteticoId => Object.hasOwn(MEDIDAS, id);

/**
 * Instrumentos SEM gravado no banco (não há o que medir), feitos como mistura ponderada de instrumentos medidos, nota a
 * nota. É aproximação, não medida: o flugelhorn costuma ser descrito entre o trompete e a trompa (mais escuro que o
 * trompete, mais vivo que a trompa) e o bombardino (euphonium) entre o trombone e a tuba (tubo cônico, como o da tuba, mas
 * na região do trombone). Os pesos são palpite a ajustar de ouvido.
 */
const MISTURAS: Record<string, [SinteticoId, number][]> = {
  flugelhorn: [["trompete", 0.5], ["trompa", 0.5]],
  bombardino: [["trombone", 0.5], ["tuba", 0.5]],
};
export const temTimbreDerivado = (id: string): id is SinteticoId => Object.hasOwn(MISTURAS, id);
/** Tem timbre por altura, medido ou derivado de medidas. */
export const temTimbre = (id: string): id is SinteticoId => temTimbreMedido(id) || temTimbreDerivado(id);

/** Ataque nunca abaixo de 20 ms (estalo) nem acima de 80 ms (o oboé gravado "incha" em 200 ms, o que num hino atrasa a nota). */
const ATAQUE_MIN = 0.02;
const ATAQUE_MAX = 0.08;
/** Só os metais abrem o brilho no começo; nas palhetas, cordas e flauta a medida é inconclusiva (quase sempre já nasce aberta). */
const COM_ABERTURA = new Set<string>(["trompete", "trombone", "tuba", "trompa"]);
/** Acima disto o "começo escuro" medido já é o espectro inteiro: não há abertura a imitar. */
const CORTE_MAXIMO = 20;
/** Abaixo da amplitude relativa 0,003 (-50 dB) o harmônico não se ouve: não entra na tabela. */
const PISO = 0.003;

function mediana(v: number[]): number {
  const o = [...v].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/**
 * Tabela de harmônicos (índice 0 ignorado, como em `Perfil`) da nota `midi` (altura que SOA, já transposta): interpola as
 * duas âncoras vizinhas. Fora da faixa medida vale a âncora da ponta, porque lá as amostras só foram deslocadas e o
 * timbre não é o do instrumento.
 */
export function harmonicosEm(id: SinteticoId, midi: number): number[] {
  const mistura = MISTURAS[id];
  if (mistura) {
    const partes = mistura.map(([c, peso]) => ({ h: harmonicosEm(c, midi), peso }));
    const n = Math.max(...partes.map((p) => p.h.length));
    const h = [0];
    for (let k = 1; k < n; k++) h.push(partes.reduce((s, p) => s + p.peso * (p.h[k] ?? 0), 0));
    while (h.length > 2 && h[h.length - 1] < PISO) h.pop();
    return h;
  }
  const m = MEDIDAS[id];
  if (!m) return INSTRUMENTOS[id].harmonicos;
  const a = m.ancoras;
  let i = a.findIndex((x) => x.midi >= midi);
  let t: number;
  if (i < 0) {
    i = a.length - 1;
    t = 0;
  } else if (i === 0) {
    t = 0;
  } else {
    t = (midi - a[i - 1].midi) / (a[i].midi - a[i - 1].midi);
    i -= 1;
  }
  const lo = a[i].h;
  const hi = a[Math.min(i + 1, a.length - 1)].h;
  const n = Math.max(lo.length, hi.length);
  const h = [0];
  for (let k = 0; k < n; k++) h.push((lo[k] ?? 0) * (1 - t) + (hi[k] ?? 0) * t);
  while (h.length > 2 && h[h.length - 1] < PISO) h.pop();
  return h;
}

/** Quanto da onda (já normalizada para pico 1, como o Web Audio faz) é volume eficaz: serve para igualar o volume entre tabelas. */
export function eficazRelativo(harmonicos: number[]): number {
  const N = 512; // pontos por período: dá para até 255 harmônicos
  let soma = 0;
  let pico = 0;
  for (let n = 0; n < N; n++) {
    let x = 0;
    for (let k = 1; k < harmonicos.length && k < N / 2; k++) x += harmonicos[k] * Math.sin((2 * Math.PI * k * n) / N);
    soma += x * x;
    pico = Math.max(pico, Math.abs(x));
  }
  return pico > 0 ? Math.sqrt(soma / N) / pico : 0;
}

const cache = new Map<string, PerfilDaNota>();

/**
 * O perfil de uma nota. Com timbre medido: tabela interpolada, ataque da mediana medida e `nivel` corrigido para que o
 * volume eficaz seja o da tabela antiga (o Web Audio normaliza o PICO da onda; uma tabela mais "pontuda" ou mais cheia
 * soaria mais baixa ou mais alta). Isso mantém válidos os ganhos dos gravados, calibrados contra o volume da síntese.
 */
export function perfilDaNota(id: SinteticoId, midi: number): PerfilDaNota {
  const base: Perfil = INSTRUMENTOS[id];
  if (!temTimbre(id)) return base;
  const chave = `${id}:${Math.round(midi)}`;
  let p = cache.get(chave);
  if (!p) {
    const harmonicos = harmonicosEm(id, Math.round(midi));
    const fator = Math.min(2, Math.max(0.5, eficazRelativo(base.harmonicos) / Math.max(1e-6, eficazRelativo(harmonicos))));
    p = { ...base, harmonicos, nivel: base.nivel * fator, ataque: ataqueMedido(id) };
    const ab = aberturaMedida(id);
    if (ab) p.abertura = ab;
    cache.set(chave, p);
  }
  return p;
}

const ataques = new Map<string, number>();
function ataqueMedido(id: SinteticoId): number {
  let v = ataques.get(id);
  if (v === undefined) {
    const mistura = MISTURAS[id];
    v = mistura
      ? mistura.reduce((s, [c, peso]) => s + peso * ataqueMedido(c), 0)
      : Math.min(ATAQUE_MAX, Math.max(ATAQUE_MIN, mediana(MEDIDAS[id].ancoras.map((a) => a.ataque))));
    ataques.set(id, v);
  }
  return v;
}

const aberturas = new Map<string, { corte: number; tempo: number } | null>();
function aberturaMedida(id: SinteticoId): { corte: number; tempo: number } | null {
  let v = aberturas.get(id);
  if (v === undefined) {
    v = null;
    const mistura = MISTURAS[id];
    if (mistura) {
      // Só abre o brilho se todos os componentes abrem (os dois pares aqui são de metais).
      const partes = mistura.map(([c, peso]) => ({ ab: aberturaMedida(c), peso }));
      if (partes.every((p) => p.ab)) {
        v = {
          corte: partes.reduce((s, p) => s + p.peso * p.ab!.corte, 0),
          tempo: partes.reduce((s, p) => s + p.peso * p.ab!.tempo, 0),
        };
      }
    } else if (COM_ABERTURA.has(id)) {
      const validas = MEDIDAS[id].ancoras.filter((a) => a.fc_inicio !== null && a.fc_inicio < CORTE_MAXIMO && a.abertura !== null);
      if (validas.length) {
        v = {
          corte: mediana(validas.map((a) => a.fc_inicio as number)),
          tempo: Math.max(0.04, mediana(validas.map((a) => a.abertura as number))),
        };
      }
    }
    aberturas.set(id, v);
  }
  return v;
}
