// O agendamento puro do metrônomo (I-20): dado o andamento, o compasso e o instante do relógio de áudio, diz quais cliques agendar. Não toca em áudio nem em temporizador, então é
// testado com um relógio falso. O padrão é o de "A Tale of Two Clocks" (Chris Wilson): um temporizador grosso só OLHA ADIANTE e agenda os cliques no relógio de áudio.

export const BPM_MIN = 30;
export const BPM_MAX = 240;
export const BPM_PADRAO = 60;
/** Tempos por compasso que a tela oferece. */
/** Os simples (2, 3 e 4 tempos) e os compostos (6, 9 e 12: colcheias, de 3 em 3). Não há 1 (não existe como compasso) nem 5 e 7 (irregulares, fora dos hinos). */
export const COMPASSOS = [2, 3, 4, 6, 9, 12] as const;
export const COMPASSO_PADRAO = 4;

/** Quanto, depois de o áudio acordar, o 1º clique espera (s): a saída ainda está começando, e no Bluetooth o primeiro som costuma se perder. */
export const ATRASO_INICIAL = 0.1;
/** De quanto em quanto o temporizador acorda para olhar adiante (ms). */
export const INTERVALO_MS = 25;
/** Quanto à frente se agenda com o app à vista (s) e escondido (s): escondido o navegador freia os temporizadores (a ~1 por segundo), então a janela é maior. */
export const JANELA = 0.1;
export const JANELA_ESCONDIDA = 2;

export function limitarBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return BPM_PADRAO;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function compassoValido(n: unknown): n is (typeof COMPASSOS)[number] {
  return typeof n === "number" && (COMPASSOS as readonly number[]).includes(n);
}

/** `n`: o número do clique desde que o metrônomo ligou (0, 1, 2…): a paridade diz de que lado do pêndulo ele está (par = esquerda, ímpar = direita). */
export type Clique = { tempo: number; indice: number; n: number };
/** `ultimo`: instante (relógio de áudio) do último clique agendado, ou null se ainda não há nenhum. `indice`: o tempo (0 = o forte) do PRÓXIMO clique. `n`: o número do PRÓXIMO clique desde que ligou. */
export type EstadoAgenda = { ultimo: number | null; indice: number; n: number };

/** Teto de cliques agendados numa chamada (a 240 bpm, 64 cliques são 16 s: muito além da maior janela). */
const MAX_CLIQUES_POR_CHAMADA = 64;

export function novoEstado(): EstadoAgenda {
  return { ultimo: null, indice: 0, n: 0 };
}

/**
 * Agenda os cliques que caem entre `agora` e `agora + janela`. O instante do próximo clique é calculado SÓ AQUI, a partir do último e do andamento de agora: assim uma troca de
 * andamento vale a partir do primeiro clique ainda não agendado (o que já está na janela soa como estava). Se o temporizador acordou tarde e o próximo clique já ficou para trás,
 * pula para o próximo ponto da grade, mantendo a fase (o tempo certo do compasso), em vez de soar todos os perdidos de uma vez.
 */
export function agendar(
  estado: EstadoAgenda,
  p: { bpm: number; compasso: number; agora: number; janela: number; atrasoInicial?: number },
): { cliques: Clique[]; estado: EstadoAgenda } {
  const cliques: Clique[] = [];
  const { compasso, agora, janela } = p;
  // A função é pública: valida tudo o que recebe, para uma entrada ruim não gerar laço infinito, memória sem fim nem NaN que trava o metrônomo em silêncio.
  if (!Number.isFinite(p.bpm) || p.bpm <= 0 || !Number.isInteger(compasso) || compasso < 1 || !Number.isFinite(agora) || !Number.isFinite(janela) || janela < 0) {
    return { cliques, estado };
  }
  const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, p.bpm));
  const periodo = 60 / bpm;
  const atraso = Number.isFinite(p.atrasoInicial) && (p.atrasoInicial as number) >= 0 ? (p.atrasoInicial as number) : ATRASO_INICIAL;
  let ultimo = estado.ultimo !== null && Number.isFinite(estado.ultimo) ? estado.ultimo : null;
  let indice = Number.isInteger(estado.indice) ? ((estado.indice % compasso) + compasso) % compasso : 0;
  let seq = Number.isInteger(estado.n) && estado.n >= 0 ? estado.n : 0;
  let proximo = ultimo === null ? agora + atraso : ultimo + periodo;
  // O 1º clique (ultimo nulo) é sempre agendado, mesmo que o atraso inicial caia fora da janela: senão o começo dependeria de uma borda de comparação.
  while ((proximo < agora + janela || ultimo === null) && cliques.length < MAX_CLIQUES_POR_CHAMADA) {
    if (proximo < agora) {
      // atrasado: pula as batidas perdidas e segue na grade, na fase certa
      const perdidas = Math.ceil((agora - proximo) / periodo);
      proximo += perdidas * periodo;
      indice = (indice + perdidas) % compasso;
      seq += perdidas;
      continue;
    }
    cliques.push({ tempo: proximo, indice, n: seq });
    ultimo = proximo;
    indice = (indice + 1) % compasso;
    seq += 1;
    proximo = ultimo + periodo;
  }
  return { cliques, estado: { ultimo, indice, n: seq } };
}
