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
