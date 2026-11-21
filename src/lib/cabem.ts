// Quantos itens de uma lista cabem no espaço que sobra na tela (as listas de usados recentemente do metrônomo e do afinador). A conta só arredonda PARA BAIXO: nunca
// mostra um item cortado pela metade, e pode sobrar um pouco de tela. Sempre mostra ao menos 1 (se houver) e nunca mais do que existe.

/**
 * @param espaco  altura livre, do começo da lista até o fim da tela (px)
 * @param item    altura de um item (px)
 * @param vao     espaço entre dois itens (px)
 * @param total   quantos itens existem
 */
export function quantosCabem(espaco: number, item: number, vao: number, total: number): number {
  if (!(total > 0)) return 0;
  if (!(item > 0) || !Number.isFinite(espaco) || !Number.isFinite(item) || !Number.isFinite(vao)) return total; // sem medida: mostra tudo
  const cabem = Math.floor((espaco + vao) / (item + vao));
  return Math.min(total, Math.max(1, cabem));
}
