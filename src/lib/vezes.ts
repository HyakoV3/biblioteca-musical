// As "vezes" de um hino: cada vez que ele é cantado do começo ao fim, uma por estrofe.
//
// Num hino com final, a ÚLTIMA vez é a diferente (o final) e as anteriores usam a versão normal.
// Cada vez é tocada sozinha: "Terceira vez" toca direto a terceira, sem passar pelas outras.
// Hino sem final tem uma só versão para todas as vezes, então a tela mostra um único botão de tocar.
import type { Nota, Voz } from "./sintetizador";

export type HinoComFinal = { vozes: Voz[]; final?: { vozes: Voz[] } | null };

/** Limite de vezes mostradas (há texto traduzido de "Primeira" a "Oitava"). */
export const VEZES_MAX = 8;

/** O hino tem uma versão de final utilizável? (mesmas vozes da versão normal, na mesma ordem) */
export function temFinal(h: HinoComFinal): boolean {
  return !!h.final && h.final.vozes.length === h.vozes.length && h.vozes.length > 0;
}

/**
 * Quantas vezes o hino tem. Sem final, 1. Com final, o número de estrofes da letra, no mínimo 2 (para a última,
 * o final, vir depois de ao menos uma vez normal) e no máximo VEZES_MAX. Ex.: 3 estrofes = 1ª, 2ª e 3ª (final).
 */
export function totalDeVezes(h: HinoComFinal, estrofes: number): number {
  if (!temFinal(h)) return 1;
  const n = Number.isFinite(estrofes) ? Math.floor(estrofes) : 0;
  return Math.min(VEZES_MAX, Math.max(2, n));
}

/** Esta vez (1 = primeira) é a do final? Só a última de um hino que tem final. */
export function ehFinal(h: HinoComFinal, vez: number, total: number): boolean {
  return temFinal(h) && vez === total;
}

/** As notas para tocar aquela vez. Vez fora do intervalo vira a primeira ou a última. */
export function vozesDaVez(h: HinoComFinal, vez: number, total: number): Voz[] {
  const v = Math.min(Math.max(1, Math.floor(vez) || 1), Math.max(1, total));
  return ehFinal(h, v, total) ? h.final!.vozes : h.vozes;
}

/**
 * O hino todo, como é cantado: a 1ª vez, a 2ª, ... até a última (o final, se houver), em sequência e sem pausa.
 * É o que toca quando a pessoa não escolhe uma vez em particular.
 */
export function montarTudo(h: HinoComFinal, total: number): Voz[] {
  return h.vozes.map((voz, i) => {
    const notas: Nota[] = [];
    let desloc = 0;
    for (let vez = 1; vez <= Math.max(1, total); vez++) {
      const vozes = vozesDaVez(h, vez, total);
      for (const [inicio, dur, midi] of vozes[i].notas) notas.push([inicio + desloc, dur, midi]);
      desloc += duracaoEmBatidas(vozes);
    }
    return { nome: voz.nome, notas };
  });
}

/** Fim da última nota entre todas as vozes, em batidas. */
export function duracaoEmBatidas(vozes: Voz[]): number {
  let fim = 0;
  for (const v of vozes) for (const [inicio, dur] of v.notas) fim = Math.max(fim, inicio + dur);
  return fim;
}
