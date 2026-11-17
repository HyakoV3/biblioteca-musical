// I-12, fase B: qual compasso da partitura está tocando. O conversor (`tools/mscx2json`) emite, por fluxo de notas, a lista
// `[batida local, índice do compasso escrito]` (docs/FORMATO.md, "Compassos"); o índice é o do N-ésimo `g.measure` do SVG da partitura.
// A batida é a de `reproducao.ponto()`: local à parte que toca (introdução, vez normal ou final), na mesma régua das notas, a mesma que
// a sincronia da letra usa.
import type { Compassos, InicioDeCompasso } from "./biblioteca.svelte";

const EPS = 1e-6;

/** O ponto da música, como `reproducao.ponto()` o devolve: só o que importa para escolher a lista de compassos. */
export type PontoDeCompasso = { parte: "intro" | number; batida: number; final: boolean };

/**
 * O índice do compasso que começa por último em ou antes de `batida` (o que está tocando), ou `null` antes do primeiro compasso, com a lista
 * vazia ou com a batida inválida. Depois do último compasso continua o último (a pausa entre as partes mantém o destaque). A lista vem em
 * ordem crescente de tempo (o app descarta na leitura a que não vem).
 */
export function compassoEm(lista: readonly InicioDeCompasso[], batida: number): number | null {
  if (!Number.isFinite(batida) || lista.length === 0 || batida < lista[0][0] - EPS) return null;
  let lo = 0;
  let hi = lista.length - 1;
  while (lo < hi) {
    const meio = (lo + hi + 1) >> 1;
    if (lista[meio][0] <= batida + EPS) lo = meio;
    else hi = meio - 1;
  }
  return lista[lo][1];
}

/**
 * Qual lista de compassos vale para este ponto: a da introdução, a do final (só na última vez, e só se o hino a traz) ou a normal. Mesma
 * regra do karaokê da letra para a passada do final.
 */
export function listaDoPonto(c: Compassos, p: PontoDeCompasso): readonly InicioDeCompasso[] | null {
  if (p.parte === "intro") return c.introducao ?? null;
  return p.final && c.final ? c.final : c.normal;
}

/** O compasso que toca neste ponto da música, ou `null` se não há (sem lista para a parte, ou antes do primeiro compasso). */
export function compassoDoPonto(c: Compassos | null | undefined, p: PontoDeCompasso | null): number | null {
  if (!c || !p) return null;
  const lista = listaDoPonto(c, p);
  return lista ? compassoEm(lista, p.batida) : null;
}
