// Regras do afinador (I-13), puras: sem som e sem tela, para se testarem no Vitest. Nome das notas, a frequência de cada uma e a
// distância em cents (1 semitom = 100 cents). A etapa "ouvir e medir" usa as mesmas contas.
import type { Idioma } from "./i18n/index.svelte";

/** Afinação de referência: o lá central (A4), em hertz. Temperamento igual. */
export const LA_PADRAO = 440;
/** Oitavas oferecidas (a 4 é a do Dó central). */
export const OITAVA_MIN = 2;
export const OITAVA_MAX = 6;
export const OITAVA_PADRAO = 4;

/**
 * Grafia fixa das 12 notas (de Dó a Si): bemol onde os hinos mais usam (Mi♭, Lá♭, Si♭) e sustenido onde falta (Dó♯, Fá♯).
 * Cada idioma tem o seu nome (em inglês, as letras).
 */
const NOMES: Record<Idioma, readonly string[]> = {
  pt: ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Lá♭", "Lá", "Si♭", "Si"],
  es: ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"],
  en: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"],
};

/** O mesmo, por extenso: o leitor de tela pode ler "♭" e "♯" como símbolos, então os rótulos de acessibilidade dizem "bemol" e "sustenido". */
const POR_EXTENSO: Record<Idioma, readonly string[]> = {
  pt: ["Dó", "Dó sustenido", "Ré", "Mi bemol", "Mi", "Fá", "Fá sustenido", "Sol", "Lá bemol", "Lá", "Si bemol", "Si"],
  es: ["Do", "Do sostenido", "Re", "Mi bemol", "Mi", "Fa", "Fa sostenido", "Sol", "La bemol", "La", "Si bemol", "Si"],
  en: ["C", "C sharp", "D", "E flat", "E", "F", "F sharp", "G", "A flat", "A", "B flat", "B"],
};

/** Classe de altura (0 = Dó … 11 = Si) dentro de 0 a 11; qualquer outro número é trazido para essa faixa. */
export const classeDe = (n: number): number => ((Math.round(n) % 12) + 12) % 12;

export const nomeDaNota = (classe: number, idioma: Idioma): string => NOMES[idioma][classeDe(classe)];
export const nomeDaNotaPorExtenso = (classe: number, idioma: Idioma): string => POR_EXTENSO[idioma][classeDe(classe)];

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
