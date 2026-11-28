// Onde está a bolinha do metrônomo (I-20): funções PURAS sobre a fila de cliques já agendados e o instante visível.
import type { Clique } from "./metronomoAgenda";

/**
 * Onde está a bolinha na trilha do compasso, de 0 a 1 (0 = o início do 1º tempo; chega a 1 no fim do último, que é o 1º tempo seguinte). `fila` são os cliques já agendados e
 * `agora`, o instante visível (o relógio de áudio menos a latência de saída). Antes do primeiro clique soar, devolve null.
 */
export function progressoNoCompasso(fila: readonly Clique[], agora: number, bpm: number, compasso: number): number | null {
  const c = cliqueAtual(fila, agora);
  if (!c || !(bpm > 0) || !(compasso >= 1)) return null;
  // O espaçamento é o até o PRÓXIMO clique da fila, quando há: logo depois de uma troca de andamento o clique em curso ainda tem o espaçamento antigo.
  const prox = fila.find((x) => x.tempo > c.tempo);
  const periodo = prox ? prox.tempo - c.tempo : 60 / bpm;
  const decorrido = Math.min(Math.max((agora - c.tempo) / periodo, 0), 1);
  return (c.indice + decorrido) / compasso;
}

/**
 * Onde está a bolinha do PÊNDULO, de 0 (esquerda) a 1 (direita): cada clique é uma ponta (par à esquerda, ímpar à direita) e entre dois cliques ela vai de uma ponta à outra, como num
 * metrônomo de verdade. O compasso não aparece no trajeto (só nas marcas e no acento). Antes do primeiro clique soar, devolve null.
 */
export function posicaoDoPendulo(fila: readonly Clique[], agora: number, bpm: number): number | null {
  const c = cliqueAtual(fila, agora);
  if (!c || !(bpm > 0)) return null;
  // Se o agendador atrasou e pulou batidas, o intervalo até o próximo clique da fila cobre VÁRIAS batidas (`passos`): a bolinha faz esse número de idas e vindas, no ritmo certo, em vez de
  // uma só (que, com um número ímpar de batidas perdidas, voltaria de uma ponta à outra num salto).
  const prox = fila.find((x) => x.tempo > c.tempo);
  const passos = prox ? Math.max(1, prox.n - c.n) : 1;
  const periodo = prox ? (prox.tempo - c.tempo) / passos : 60 / bpm;
  const t = Math.min(Math.max((agora - c.tempo) / periodo, 0), passos);
  const m = (c.n + t) % 2; // onda triangular: 0 (esquerda) → 1 (direita) → 0…
  return m <= 1 ? m : 2 - m;
}

/** De que lado o clique mais recente soou (0 = esquerda, 1 = direita), ou null antes do primeiro: com movimento reduzido a bolinha só pula de ponta em ponta. */
export function ladoDoClique(fila: readonly Clique[], agora: number): 0 | 1 | null {
  const c = cliqueAtual(fila, agora);
  return c ? (c.n % 2 === 0 ? 0 : 1) : null;
}

/** O tempo (0 = o forte) cujo clique soou por último até `agora`, ou null antes do primeiro. */
export function tempoAceso(fila: readonly Clique[], agora: number): number | null {
  return cliqueAtual(fila, agora)?.indice ?? null;
}

function cliqueAtual(fila: readonly Clique[], agora: number): Clique | null {
  let achado: Clique | null = null;
  for (const c of fila) {
    if (c.tempo <= agora && (achado === null || c.tempo >= achado.tempo)) achado = c;
  }
  return achado;
}
