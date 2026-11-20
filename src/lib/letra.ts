// Separa a letra (lista de linhas, com linha vazia entre estrofes) em estrofes.
// A primeira linha de cada estrofe pode vir como "1. texto": o número vira rótulo e sai do verso.
// Um parágrafo que começa com "Coro. texto" é o coro (refrão): `coro: true`, `numero: 0` (é o número dele na sincronia).

export type Estrofe = { numero: number | null; linhas: string[]; coro?: boolean };

/** Quantas estrofes cantadas o hino tem (o coro não é uma vez a mais). */
export function totalDeEstrofes(letra: string[]): number {
  return estrofes(letra).filter((e) => !e.coro).length;
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
    const m = c ? null : /^(\d+)\.\s+(.*)$/.exec(linha);
    if (!atual) {
      atual = c ? { numero: 0, linhas: [], coro: true } : { numero: m ? Number(m[1]) : null, linhas: [] };
      saida.push(atual);
    }
    atual.linhas.push(atual.linhas.length === 0 && (c || m) ? (c ?? m)![c ? 1 : 2] : linha);
  }
  return saida;
}
