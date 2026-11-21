// Nomes das notas (e das tonalidades): em sílabas (Dó, Ré, Mi… e Si♭) ou em letras (C, D, E… e B♭). "Automático" segue o idioma da interface: português e espanhol em sílabas,
// inglês em letras. A escolha é lembrada no aparelho (src/lib/notacao.svelte.ts). Puro: sem tela e sem armazenamento, para se testar no Vitest.
import type { Idioma } from "./i18n/index.svelte";

export const NOTACOES = ["auto", "silabas", "letras"] as const;
export type Notacao = (typeof NOTACOES)[number];
export const CHAVE_NOTACAO = "notacao";
export const ehNotacao = (x: unknown): x is Notacao => typeof x === "string" && (NOTACOES as readonly string[]).includes(x);

/** Os três sistemas de nomes que existem: sílabas em português, sílabas em espanhol (sem acento) e letras. */
export type Sistema = "pt" | "es" | "en";

/** Qual sistema vale: o automático segue o idioma; "sílabas" usa o espanhol só quando a interface está em espanhol (senão, o português); "letras" são as letras. */
export function sistemaDe(notacao: Notacao, idioma: Idioma): Sistema {
  if (notacao === "letras") return "en";
  if (notacao === "silabas") return idioma === "es" ? "es" : "pt";
  return idioma;
}

/** As 12 notas, de Dó a Si, com a grafia fixa que os hinos mais usam (bemol em Mi♭, Lá♭ e Si♭; sustenido em Dó♯ e Fá♯). */
const NOMES: Record<Sistema, readonly string[]> = {
  pt: ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Lá♭", "Lá", "Si♭", "Si"],
  es: ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"],
  en: ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"],
};
/** As 7 notas naturais, de Dó a Si. */
const NATURAIS: Record<Sistema, readonly string[]> = {
  pt: ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"],
  es: ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"],
  en: ["C", "D", "E", "F", "G", "A", "B"],
};
const PALAVRAS: Record<Idioma, { bemol: string; sustenido: string }> = {
  pt: { bemol: "bemol", sustenido: "sustenido" },
  es: { bemol: "bemol", sustenido: "sostenido" },
  en: { bemol: "flat", sustenido: "sharp" },
};
const MODOS: Record<Idioma, { maior: string; menor: string }> = {
  pt: { maior: "maior", menor: "menor" },
  es: { maior: "mayor", menor: "menor" },
  en: { maior: "major", menor: "minor" },
};

const classeDe = (n: number): number => ((Math.round(n) % 12) + 12) % 12;

/** O nome da nota de classe 0 (Dó) a 11 (Si), no sistema escolhido. */
export const nomeDaNota = (classe: number, idioma: Idioma, notacao: Notacao = "auto"): string => NOMES[sistemaDe(notacao, idioma)][classeDe(classe)];

/** O mesmo, por extenso: o leitor de tela pode ler "♭" e "♯" como símbolos, então os rótulos de acessibilidade dizem "bemol"/"flat" e "sustenido"/"sharp" (na língua da interface). */
export function nomeDaNotaPorExtenso(classe: number, idioma: Idioma, notacao: Notacao = "auto"): string {
  const p = PALAVRAS[idioma];
  return nomeDaNota(classe, idioma, notacao).replace("♭", ` ${p.bemol}`).replace("♯", ` ${p.sustenido}`);
}

const BASE = /^(Dó|Do|Ré|Re|Mi|Fá|Fa|Sol|Lá|La|Si|[A-G])([♭♯b#]?)\s+(maior|menor|major|minor|mayor)$/;
const INDICE: Record<string, number> = { Dó: 0, Do: 0, C: 0, Ré: 1, Re: 1, D: 1, Mi: 2, E: 2, Fá: 3, Fa: 3, F: 3, Sol: 4, G: 4, Lá: 5, La: 5, A: 5, Si: 6, B: 6 };

/**
 * Escreve a tonalidade de um hino ("Mi♭ maior") no sistema escolhido ("E♭ major", "Mib maior"...). Mantém a grafia do hinário (Ré♭ continua Ré♭, e não vira Dó♯) e escreve
 * "maior/menor" na língua da interface. Um texto que não se reconhece volta como veio.
 */
export function nomeDaTonalidade(tom: string, idioma: Idioma, notacao: Notacao = "auto"): string {
  const m = BASE.exec(tom.trim());
  if (!m) return tom;
  const nota = NATURAIS[sistemaDe(notacao, idioma)][INDICE[m[1]!]!];
  const acidente = m[2] === "♭" || m[2] === "b" ? "♭" : m[2] === "♯" || m[2] === "#" ? "♯" : "";
  const modo = /^(maior|major|mayor)$/.test(m[3]!) ? MODOS[idioma].maior : MODOS[idioma].menor;
  return `${nota}${acidente} ${modo}`;
}
