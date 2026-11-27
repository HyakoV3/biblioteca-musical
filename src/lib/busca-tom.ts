// Leitura da tonalidade ("Mi♭ maior", "sib", "tom si") na consulta e no texto do hino. Pura.

import { normalizarComMapa, palavrasDe } from "./busca-normalizar";


export type Tom = { classe: number; modo: "maior" | "menor" | null };
const NOTAS: Record<string, number> = { do: 0, c: 0, re: 2, d: 2, mi: 4, e: 4, fa: 5, f: 5, sol: 7, g: 7, la: 9, a: 9, si: 11, b: 11 };
const SILABAS = new Set(["do", "re", "mi", "fa", "sol", "la", "si"]);
/** Palavras comuns do português que também são nome de nota: só viram tom quando a consulta inteira é o tom (ou vêm depois de "tom"). */
const NOTAS_COMUNS = new Set(["a", "e", "do", "la"]);
/** A nota (0 a 11) de um nome, sem achar propriedades herdadas do objeto ("constructor"). */
const notaDe = (w: string | undefined): number | undefined => (w !== undefined && Object.hasOwn(NOTAS, w) ? NOTAS[w] : undefined);
/** "sib", "mib", "solb", "bb", "eb": a nota com o bemol colado, sem símbolo. */
const BEMOL_COLADO = /^(do|re|mi|fa|sol|la|si|[a-g])b$/;

function acidenteDe(t: string): number | null {
  if (t === "bemol" || t === "flat" || t === "b") return -1; // "b" solto, depois de uma nota ("si b")
  if (t === "sustenido" || t === "sostenido" || t === "sharp") return 1;
  return null;
}
function modoDe(t: string): "maior" | "menor" | null {
  if (t === "maior" || t === "major" || t === "mayor") return "maior";
  if (t === "menor" || t === "minor") return "menor";
  return null;
}

/** ♭ e ♯ viram palavras ("mi♭" → "mi bemol"), para o texto digitado e o do hinário passarem pelo mesmo caminho. */
const comAcidentesEmPalavras = (s: string): string => s.replace(/♭/g, " bemol ").replace(/♯|#/g, " sustenido ");

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/**
 * Lê a tonalidade do TEXTO de um hino ("Mi♭ maior", "E♭ major"). Mesma classe de nota e modo servem de comparação, e não o texto: o hinário
 * escreve Ré♭, a pessoa pode digitar "dó sustenido".
 */
export function tomDoHino(tonalidade: string | null | undefined): Tom | null {
  if (!tonalidade) return null;
  const t = palavrasDe(normalizarComMapa(comAcidentesEmPalavras(tonalidade)).n);
  const modo = t.map(modoDe).find((m) => m !== null) ?? null;
  const colado = t[0] !== undefined ? BEMOL_COLADO.exec(t[0]) : null; // "Sib maior", "Eb major", "Bb major"
  if (colado) return { classe: mod12(notaDe(colado[1])! - 1), modo };
  const nota = notaDe(t[0]);
  if (nota === undefined) return null;
  const acidente = t[1] !== undefined ? (acidenteDe(t[1]) ?? 0) : 0;
  return { classe: mod12(nota + acidente), modo };
}

/**
 * Procura nos termos da consulta uma tonalidade: nota + acidente, colados ou separados ("sib", "si b", "si bemol", "mi♭"), nota + "maior/menor"
 * ("mi maior"), ou a palavra "tom" antes de uma nota ("tom si"). Uma nota SOZINHA ("la", "sol", "si", "a", "e") NÃO é tom: é texto.
 * Devolve o tom e os termos que sobram (os que a tonalidade não consumiu).
 */
export function extrairTom(bruta: string): { tom: Tom | null; resto: string[]; todos: string[]; ambiguo: boolean } {
  const termos = palavrasDe(normalizarComMapa(comAcidentesEmPalavras(bruta)).n);
  const sem = (usados: number[]) => termos.filter((_, k) => !usados.includes(k));
  for (let i = 0; i < termos.length; i++) {
    const w = termos[i]!;
    const aposTom = termos[i - 1] === "tom";
    const prefixoTom = aposTom ? [i - 1] : [];

    // "sib", "mib", "solb", "bb", "eb": a nota com o bemol colado
    const colado = BEMOL_COLADO.exec(w);
    if (colado) {
      const modo = termos[i + 1] ? modoDe(termos[i + 1]!) : null;
      // Colado e ainda sendo digitado ("reb" a caminho de "rebanho", "lab" de "labor"): pode ser tom OU o começo de uma palavra. Com "tom" antes ou um modo depois, é tom.
      const ambiguo = i === termos.length - 1 && !aposTom && !modo;
      return { tom: { classe: mod12(notaDe(colado[1])! - 1), modo }, resto: sem([...prefixoTom, i, ...(modo ? [i + 1] : [])]), todos: termos, ambiguo };
    }

    const nota = notaDe(w);
    if (nota === undefined) continue;
    const seguinte = termos[i + 1];
    const acidente = seguinte !== undefined ? acidenteDe(seguinte) : null;
    const posModo = acidente !== null ? i + 2 : i + 1;
    const modo = termos[posModo] ? modoDe(termos[posModo]!) : null;
    if (!(aposTom || acidente !== null || modo !== null)) continue; // nota sozinha: texto
    const usados = [...prefixoTom, i, ...(acidente !== null ? [i + 1] : []), ...(modo !== null ? [posModo] : [])];
    // "Deus é maior", "a maior glória", "do maior amor": "é", "a", "do" e "lá" são palavras comuns; só valem como tom se a consulta inteira é o tom ou se vêm depois de "tom".
    if (NOTAS_COMUNS.has(w) && !aposTom && usados.length < termos.length) continue;
    return { tom: { classe: mod12(nota + (acidente ?? 0)), modo }, resto: sem(usados), todos: termos, ambiguo: false };
  }
  return { tom: null, resto: termos, todos: termos, ambiguo: false };
}
