// Separa a letra (lista de linhas, com linha vazia entre estrofes) em estrofes.
// A primeira linha de cada estrofe pode vir como "1. texto": o número vira rótulo e sai do verso.

export type Estrofe = { numero: number | null; linhas: string[] };

export function estrofes(letra: string[]): Estrofe[] {
  const saida: Estrofe[] = [];
  let atual: Estrofe | null = null;
  for (const linha of letra) {
    if (linha.trim() === "") {
      atual = null;
      continue;
    }
    const m = /^(\d+)\.\s+(.*)$/.exec(linha);
    if (!atual) {
      atual = { numero: m ? Number(m[1]) : null, linhas: [] };
      saida.push(atual);
    }
    atual.linhas.push(m && atual.linhas.length === 0 ? m[2] : linha);
  }
  return saida;
}
