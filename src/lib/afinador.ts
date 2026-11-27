// Regras do afinador (I-13), puras: sem som e sem tela, para se testarem no Vitest. Nome das notas, a frequência de cada uma e a
// distância em cents (1 semitom = 100 cents). A etapa "ouvir e medir" usa as mesmas contas.
import type { Idioma } from "./i18n/index.svelte";

/** Afinação de referência: o lá central (A4), em hertz. Temperamento igual. */
export const LA_PADRAO = 440;
/** Oitavas oferecidas (a 4 é a do Dó central). */
export const OITAVA_MIN = 2;
export const OITAVA_MAX = 6;
export const OITAVA_PADRAO = 4;

/** Classe de altura (0 = Dó … 11 = Si) dentro de 0 a 11; qualquer outro número é trazido para essa faixa. */
export const classeDe = (n: number): number => ((Math.round(n) % 12) + 12) % 12;

// Os nomes das notas (sílabas ou letras, conforme a escolha em Ajustes) ficam em `notacao.ts`; aqui só se reexportam para quem já os importava daqui.
export { nomeDaNota, nomeDaNotaPorExtenso } from "./notacao";

/** Mantém a oitava na faixa oferecida; o que não for número volta à padrão. */
export function limitarOitava(o: unknown): number {
  if (typeof o !== "number" || !Number.isFinite(o)) return OITAVA_PADRAO;
  return Math.min(OITAVA_MAX, Math.max(OITAVA_MIN, Math.round(o)));
}

/** Número MIDI da nota (Dó4 = 60, Lá4 = 69). */
export const midiDe = (classe: number, oitava: number): number => 12 * (Math.round(oitava) + 1) + classeDe(classe);

/** Frequência, em hertz, de um número MIDI, dada a afinação do lá central. */
export const frequenciaDe = (midi: number, la: number = LA_PADRAO): number => la * 2 ** ((midi - 69) / 12);

/** Quantos cents `freq` está acima (positivo) ou abaixo (negativo) de `referencia`. */
export const centsEntre = (freq: number, referencia: number): number => 1200 * Math.log2(freq / referencia);

/** A nota mais próxima de uma frequência e quantos cents faltam (ou sobram) para ela. Frequência ou afinação de referência inválida: nulo. */
export function notaMaisProxima(freq: number, la: number = LA_PADRAO): { midi: number; classe: number; oitava: number; cents: number } | null {
  if (!Number.isFinite(freq) || freq <= 0 || !Number.isFinite(la) || la <= 0) return null;
  const midi = Math.round(69 + 12 * Math.log2(freq / la));
  return { midi, classe: classeDe(midi), oitava: Math.floor(midi / 12) - 1, cents: centsEntre(freq, frequenciaDe(midi, la)) };
}

// ---- "Qual nota é essa?" (I-35): contas puras do medidor de vizinhas. Sem microfone e sem tela. ----

/** A nota do centro só muda depois de a leitura passar deste tanto de cents da nota atual (evita o nome piscar entre duas notas). */
export const HISTERESE_CENTS = 60;
/** As pontas da trilha valem ±50 cents (onde a vizinha passa a ser a nota mais próxima). */
export const PONTA_CENTS = 50;
/** Faixa em que a nota é dada como afinada (±5 cents). */
export const AFINADO_CENTS = 5;

export type Leitura = { midi: number; cents: number };

/**
 * A nota do centro e os cents em relação a ela, com histerese: se já havia uma nota (`atual`), ela só é trocada quando a frequência
 * se afasta mais de `limite` cents dela; antes disso continua a mesma, com cents entre ±limite (a bola fica presa na ponta da trilha).
 * Sem nota atual, vale a mais próxima. Frequência inválida: nulo.
 */
export function leituraComHisterese(freq: number, atual: number | null, la: number = LA_PADRAO, limite: number = HISTERESE_CENTS): Leitura | null {
  const perto = notaMaisProxima(freq, la); // já recusa frequência e afinação inválidas
  if (!perto) return null;
  // `atual` que não é uma nota (NaN, fração) e `limite` inválido não escondem erro: a nota atual é ignorada e o limite volta ao padrão.
  if (!Number.isFinite(limite) || limite <= 0) limite = HISTERESE_CENTS;
  if (atual !== null && Number.isInteger(atual)) {
    const cents = centsEntre(freq, frequenciaDe(atual, la));
    if (Math.abs(cents) <= limite) return { midi: atual, cents };
  }
  return { midi: perto.midi, cents: perto.cents };
}

/** Onde a bola fica na trilha, de −1 (ponta esquerda, a nota abaixo) a 1 (ponta direita, a nota acima); passando de ±50 cents, presa na ponta. */
export const posicaoNaTrilha = (cents: number): number => (Number.isFinite(cents) ? Math.max(-1, Math.min(1, cents / PONTA_CENTS)) : 0);

export type Palavra = "afinado" | "baixo" | "alto";
/** "Afinado" dentro de ±5 cents; fora, "baixo" (abaixo da nota) ou "alto" (acima). Leitura inválida (NaN): nulo, para a tela não mostrar "alto" sem ter lido nada. */
export const palavraDeAfinacao = (cents: number, tolerancia: number = AFINADO_CENTS): Palavra | null =>
  !Number.isFinite(cents) ? null : Math.abs(cents) <= tolerancia ? "afinado" : cents < 0 ? "baixo" : "alto";

/** As vizinhas de uma nota: a de baixo e a de cima (um semitom). */
export const vizinhas = (midi: number): { abaixo: number; acima: number } => ({ abaixo: midi - 1, acima: midi + 1 });

/**
 * Instrumentos que transpõem: quantos semitons a nota ESCRITA fica acima da que SOA (em concerto). Trompete e clarinete em Si♭ soam um tom
 * abaixo do escrito (+2); sax alto em Mi♭ soa uma sexta maior abaixo (+9); trompa em Fá soa uma quinta abaixo (+7). Os de concerto (0) lêem o que soa.
 */
export const DESLOCAMENTO_ESCRITO = { concerto: 0, si_bemol: 2, mi_bemol: 9, fa: 7 } as const;
export type Transposicao = keyof typeof DESLOCAMENTO_ESCRITO;
/** A nota (MIDI) que o músico lê na partitura dele, a partir da que soa. */
export const notaEscrita = (midiQueSoa: number, instrumento: Transposicao): number => midiQueSoa + DESLOCAMENTO_ESCRITO[instrumento];

/** Mediana (vibrato da voz, ruído): de uma janela de leituras recentes. Valores não finitos (NaN, infinito) são descartados; sem nenhum válido: nulo. */
export function mediana(valores: readonly number[]): number | null {
  const o = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (o.length === 0) return null;
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Por que o microfone não abriu: permissão negada ou bloqueada (`negada`), nenhum microfone ou sem suporte (`sem_microfone`), ou qualquer outra falha (`falhou`). */
export function erroDeEscuta(e: unknown): "negada" | "sem_microfone" | "falhou" {
  if (!(e instanceof DOMException)) return "falhou";
  if (e.name === "NotAllowedError" || e.name === "SecurityError") return "negada";
  if (e.name === "NotFoundError" || e.name === "NotSupportedError") return "sem_microfone";
  return "falhou";
}
