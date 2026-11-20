// As "vezes" de um hino: cada vez que ele é cantado do começo ao fim, uma por estrofe.
//
// Num hino com final, a ÚLTIMA vez é a diferente (o final) e as anteriores usam a versão normal.
// Cada vez é tocada sozinha: "Terceira vez" toca direto a terceira, sem passar pelas outras.
// Hino sem final tem a mesma música em todas as vezes (uma por estrofe), mas o hino todo ainda as repete,
// para o músico saber em que vez está.
import type { Nota, Voz } from "./sintetizador";

export type HinoComFinal = {
  vozes: Voz[];
  final?: { vozes: Voz[] } | null;
  /** Do começo até o fim da nota marcada com "*" (mesmas vozes, na mesma ordem). */
  introducao?: { vozes: Voz[] } | null;
};

/** Limite de vezes mostradas (há texto traduzido de "Primeira" a "Oitava"). */
export const VEZES_MAX = 8;

/** O hino tem uma versão de final utilizável? (mesmas vozes da versão normal, na mesma ordem) */
export function temFinal(h: HinoComFinal): boolean {
  return !!h.final && h.final.vozes.length === h.vozes.length && h.vozes.length > 0;
}

/**
 * Quantas vezes o hino tem: uma por estrofe da letra, no máximo VEZES_MAX. Com final, no mínimo 2 (para a última,
 * o final, vir depois de ao menos uma vez normal). Sem letra ou com uma estrofe, 1.
 * Ex.: 3 estrofes com final = 1ª, 2ª e 3ª (final); 4 estrofes sem final = 4 vezes iguais.
 */
export function totalDeVezes(h: HinoComFinal, estrofes: number): number {
  const n = Number.isFinite(estrofes) ? Math.floor(estrofes) : 0;
  return Math.min(VEZES_MAX, Math.max(temFinal(h) ? 2 : 1, n));
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

/** Uma parte do "hino todo": a introdução ou uma vez, com o trecho que ocupa (em batidas, já com as pausas). */
export type ParteDoTudo = { parte: "intro" | number; inicio: number; fim: number; vozes: Voz[] };

/**
 * As partes de "Tocar o hino todo", na ordem: introdução (se houver), 1ª vez, 2ª, ... até a última (o final, se
 * houver). Entre uma parte e a seguinte entra uma pausa de `pausa` batidas, para dar tempo de respirar.
 */
export function partesDoTudo(h: HinoComFinal, total: number, pausa = 0): ParteDoTudo[] {
  const folga = Number.isFinite(pausa) ? Math.max(0, pausa) : 0;
  const brutas: { parte: "intro" | number; vozes: Voz[] }[] = [];
  if (temIntroducao(h)) brutas.push({ parte: "intro", vozes: h.introducao!.vozes });
  for (let vez = 1; vez <= Math.max(1, total); vez++) brutas.push({ parte: vez, vozes: vozesDaVez(h, vez, total) });
  let desloc = 0;
  return brutas.map(({ parte, vozes }) => {
    const inicio = desloc;
    const fim = inicio + duracaoEmBatidas(vozes);
    desloc = fim + folga;
    return { parte, inicio, fim, vozes };
  });
}

/**
 * O hino todo, como é cantado: as partes de `partesDoTudo` em sequência, cada voz com as notas de todas elas.
 * É o que toca quando a pessoa não escolhe uma parte em particular.
 */
export function montarTudo(h: HinoComFinal, total: number, pausa = 0): Voz[] {
  const partes = partesDoTudo(h, total, pausa);
  return h.vozes.map((voz, i) => {
    const notas: Nota[] = [];
    for (const { inicio, vozes } of partes) {
      for (const [ini, dur, midi] of vozes[i].notas) notas.push([ini + inicio, dur, midi]);
    }
    return { nome: voz.nome, notas };
  });
}

/**
 * Qual parte está tocando no instante `batida` do hino todo. Na pausa entre duas partes vale a que acabou de
 * terminar (muda quando a próxima começa). Antes do início ou sem partes, devolve a primeira.
 */
export function parteNaBatida(partes: Pick<ParteDoTudo, "parte" | "inicio">[], batida: number): "intro" | number | null {
  if (partes.length === 0) return null;
  let atual = partes[0].parte;
  for (const p of partes) {
    if (batida >= p.inicio) atual = p.parte;
    else break;
  }
  return atual;
}

/** Fim da última nota entre todas as vozes, em batidas. */
export function duracaoEmBatidas(vozes: Voz[]): number {
  let fim = 0;
  for (const v of vozes) for (const [inicio, dur] of v.notas) fim = Math.max(fim, inicio + dur);
  return fim;
}
