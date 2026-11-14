// Monta as notas de várias passadas de um hino, com ou sem a passada do final.
//
// Um hino traz as notas de UMA passada normal (`vozes`) e, se tiver final, as da última passada (`final`).
// Tocar N passadas = (N-1) passadas normais + a do final. Sem final (ou com ele desligado) = N normais.
// As vozes do final correspondem às da passada normal pela posição (o Rust recusa arquivos em que não correspondem).
import type { Nota, Voz } from "./sintetizador";

export type HinoComFinal = { vozes: Voz[]; final?: { vozes: Voz[] } | null };

/** Fim da última nota entre todas as vozes, em batidas. */
export function duracaoEmBatidas(vozes: Voz[]): number {
  let fim = 0;
  for (const v of vozes) for (const [inicio, dur] of v.notas) fim = Math.max(fim, inicio + dur);
  return fim;
}

/** O hino tem uma passada do final utilizável? */
export function temFinal(h: HinoComFinal): boolean {
  return !!h.final && h.final.vozes.length === h.vozes.length && h.vozes.length > 0;
}

/**
 * Notas de `passadas` passadas em sequência (mínimo 1), sem pausa entre elas.
 * Com `comFinal` e um final disponível, a última passada é a do final.
 */
export function montarPassadas(h: HinoComFinal, passadas: number, comFinal: boolean): Voz[] {
  const total = Number.isFinite(passadas) ? Math.max(1, Math.floor(passadas)) : 1;
  const usarFinal = comFinal && temFinal(h);
  const normais = usarFinal ? total - 1 : total;
  const duracaoNormal = duracaoEmBatidas(h.vozes);

  return h.vozes.map((voz, i) => {
    const notas: Nota[] = [];
    for (let k = 0; k < normais; k++) {
      for (const [inicio, dur, midi] of voz.notas) notas.push([inicio + k * duracaoNormal, dur, midi]);
    }
    if (usarFinal) {
      for (const [inicio, dur, midi] of h.final!.vozes[i].notas) notas.push([inicio + normais * duracaoNormal, dur, midi]);
    }
    return { nome: voz.nome, notas };
  });
}
