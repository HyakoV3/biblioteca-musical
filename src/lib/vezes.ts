// As "vezes" de um hino: cada vez que ele é cantado do começo ao fim, uma por estrofe.
//
// Num hino com final, a ÚLTIMA vez é a diferente (o final) e as anteriores usam a versão normal.
// Cada vez é tocada sozinha: "Terceira vez" toca direto a terceira, sem passar pelas outras.
// Hino sem final tem uma só versão para todas as vezes, então a tela mostra um único botão de tocar.
import type { Nota, Voz } from "./sintetizador";

export type HinoComFinal = {
  vozes: Voz[];
  final?: { vozes: Voz[] } | null;
  /** Do começo até o marcador "*" (mesmas vozes, na mesma ordem). */
  introducao?: { vozes: Voz[] } | null;
};

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

/** Pausa entre a introdução e a 1ª vez, e entre uma vez e a seguinte, em "Tocar o hino todo". */
export const PAUSA_ENTRE_PARTES_S = 2;

/** O hino tem introdução utilizável? (mesmas vozes da versão normal, na mesma ordem, com alguma nota) */
export function temIntroducao(h: HinoComFinal): boolean {
  const i = h.introducao;
  return !!i && i.vozes.length === h.vozes.length && h.vozes.length > 0 && i.vozes.some((v) => v.notas.length > 0);
}

/** As notas da introdução (vazio se o hino não tem). */
export function vozesDaIntroducao(h: HinoComFinal): Voz[] {
  return temIntroducao(h) ? h.introducao!.vozes : [];
}

/**
 * O hino todo, como é cantado: introdução (se houver), 1ª vez, 2ª, ... até a última (o final, se houver), em
 * sequência. Entre uma parte e a seguinte entra uma pausa de `pausa` batidas, para dar tempo de respirar.
 * É o que toca quando a pessoa não escolhe uma parte em particular.
 */
export function montarTudo(h: HinoComFinal, total: number, pausa = 0): Voz[] {
  const partes: Voz[][] = [];
  if (temIntroducao(h)) partes.push(h.introducao!.vozes);
  for (let vez = 1; vez <= Math.max(1, total); vez++) partes.push(vozesDaVez(h, vez, total));
  const folga = Number.isFinite(pausa) ? Math.max(0, pausa) : 0;
  return h.vozes.map((voz, i) => {
    const notas: Nota[] = [];
    let desloc = 0;
    for (const vozes of partes) {
      for (const [inicio, dur, midi] of vozes[i].notas) notas.push([inicio + desloc, dur, midi]);
      desloc += duracaoEmBatidas(vozes) + folga;
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
