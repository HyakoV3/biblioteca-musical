// Separa a letra (lista de linhas, com linha vazia entre estrofes) em estrofes.
// A primeira linha de cada estrofe pode vir como "1. texto": o número vira rótulo e sai do verso.
// Um parágrafo que começa com "Coro. texto" é o coro (refrão): `coro: true`; com "Final. texto", o final (cantado só na última vez): `final: true`.
// Os dois levam `numero: 0` (é o número deles na sincronia; um hino não tem os dois).

export type Estrofe = { numero: number | null; linhas: string[]; coro?: boolean; final?: boolean };

/** Quantas estrofes cantadas o hino tem (o coro e o final não são uma vez a mais). */
export function totalDeEstrofes(letra: string[]): number {
  return estrofes(letra).filter((e) => !e.coro && !e.final).length;
}

export function estrofes(letra: string[]): Estrofe[] {
  const saida: Estrofe[] = [];
  let atual: Estrofe | null = null;
  for (const linha of letra) {
    if (linha.trim() === "") {
      atual = null;
      continue;
    }
    const c = /^Coro\.\s+(.*)$/.exec(linha);
    const f = c ? null : /^Final\.\s+(.*)$/.exec(linha);
    const m = c || f ? null : /^(\d+)\.\s+(.*)$/.exec(linha);
    if (!atual) {
      atual = c ? { numero: 0, linhas: [], coro: true } : f ? { numero: 0, linhas: [], final: true } : { numero: m ? Number(m[1]) : null, linhas: [] };
      saida.push(atual);
    }
    const marcado = c ?? f ?? m;
    atual.linhas.push(atual.linhas.length === 0 && marcado ? marcado[c || f ? 1 : 2] : linha);
  }
  return saida;
}

/**
 * No alinhamento justificado cada verso é um parágrafo próprio, e o CSS nunca estica a ÚLTIMA linha de um parágrafo (que, num verso que cabe numa
 * linha só, é a linha inteira: nada era justificado). Por isso o justificado usa `text-align-last: justify` nos versos, e esta regra separa os versos
 * curtos demais ("Amém.", "Aleluia!"): esticados até a margem, ficariam com buracos enormes entre as palavras. Curto = menos de 60% do maior verso do hino.
 */
export function maiorVerso(partes: Estrofe[]): number {
  return Math.max(0, ...partes.flatMap((e) => e.linhas.map((l) => l.length)));
}

export function versoCurto(linha: string, maior: number): boolean {
  return linha.length < maior * 0.6;
}
