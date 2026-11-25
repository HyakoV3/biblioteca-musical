// Os campos da pessoa no registro de uma gravação (I-39): o nome que ela deu e a estrela de favorita. PURO. O texto da pessoa é sempre limpo ao guardar e ao ler: sem quebra de linha,
// com espaços colapsados, em NFC e com no máximo `TITULO_MAX` caracteres VISÍVEIS (um emoji conta um, e não dois). Título vazio vale "sem nome": volta ao nome padrão.
import type { MetaGravacao } from "./gravacoes";

export const TITULO_MAX = 80;

const segmentar: ((s: string) => string[]) | null =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? (s) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment)
    : null;

/** O nome limpo, ou nulo se não sobra nada (ou se não é texto). */
export function limparTitulo(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto
    .normalize("NFC")
    // Controles (C0, DEL e C1), separadores de linha e de parágrafo e os de direção do texto viram espaço.
    .replace(/[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Só invisíveis (espaço de largura zero, preenchimentos do Hangul e do braille): sem nada para ler, vale "sem nome".
  if (!limpo || !/[^\p{Cf}\p{Z}\p{M}\u3164\u2800]/u.test(limpo)) return null;
  const partes = segmentar ? segmentar(limpo) : Array.from(limpo);
  return partes.length > TITULO_MAX ? partes.slice(0, TITULO_MAX).join("").trim() : limpo;
}

/** O registro com `titulo` e `favorita` validados: o que não vale é REMOVIDO (não vira lixo na tela). Os outros campos, conhecidos ou não, ficam como estão. */
export function normalizarMeta(m: MetaGravacao): MetaGravacao {
  const { titulo, favorita, ...resto } = m;
  const t = limparTitulo(titulo);
  return { ...resto, ...(t ? { titulo: t } : {}), ...(favorita === true ? { favorita: true } : {}) };
}
