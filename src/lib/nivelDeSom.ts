// Parte pura do medidor de som do gravador: de amostras a nível de 0 a 1, a barra do botão e o detector de "sem som". Reexportada por `gravador.ts`.

// ---- Medidor de som (o que o microfone está ouvindo) ----

/** Abaixo de −60 dBFS o medidor mostra silêncio; 0 dBFS é o fundo de escala (o máximo que o microfone entrega). */
export const PISO_DB = -60;

/** O nível de 0 a 1 que a barra mostra, a partir do RMS das amostras (−1 a 1), em escala de decibéis (é assim que o ouvido percebe volume). */
export function nivelDeRms(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) - PISO_DB) / -PISO_DB));
}

/** A barra do botão mostra só a faixa útil da voz: de −50 dBFS (quase silêncio) a −8 dBFS (alto); fora dela, vazia ou cheia. */
export const BARRA_PISO_DB = -50;
export const BARRA_TETO_DB = -8;

/** Converte o nível do medidor (0 a 1, escala de −60 a 0 dBFS) para a escala da barra, mais estreita, e com uma curva de cosseno (0 → 0, 0,25 → 0,15, 0,5 → 0,5, 1 → 1), para ela balançar menos. */
export function nivelParaBarra(nivel: number): number {
  if (!Number.isFinite(nivel)) return 0;
  const db = Math.min(1, Math.max(0, nivel)) * -PISO_DB + PISO_DB;
  const x = Math.min(1, Math.max(0, (db - BARRA_PISO_DB) / (BARRA_TETO_DB - BARRA_PISO_DB)));
  return (1 - Math.cos(Math.PI * x)) / 2; // curva de cosseno: achata as pontas (sussurro e grito mexem menos), o meio fica igual
}

/** Cada quadro (80 ms) a barra cai a esta fração do que estava: meia-vida de uns 0,4 s. Sobe rápido, cai devagar, como medidor de estúdio. */
export const QUEDA_DA_BARRA = 0.88;
const SUBIDA_DA_BARRA = 0.6;

/** Próximo valor da barra: sobe 60% do caminho até o nível novo, e cai devagar quando ele é menor. */
export function suavizarBarra(anterior: number, atual: number): number {
  return atual >= anterior ? anterior + (atual - anterior) * SUBIDA_DA_BARRA : Math.max(atual, anterior * QUEDA_DA_BARRA);
}

/** Raiz da média dos quadrados das amostras (a "força" do som). Sem amostras, 0. */
export function rmsDeAmostras(amostras: ArrayLike<number>): number {
  const n = amostras.length;
  if (n === 0) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += amostras[i] * amostras[i];
  return Math.sqrt(soma / n);
}

/** Nível a partir do qual conta como "tem som" (cerca de −48 dBFS: acima do chiado de um microfone parado, abaixo de uma voz baixa). */
export const LIMIAR_SOM = 0.2;
/** Quanto tempo sem som até avisar que o microfone não está ouvindo nada. */
export const SILENCIO_MS = 3000;

/**
 * Acompanha o nível do microfone e diz se há som agora e se faz tempo demais que não há (para avisar "não estou ouvindo nada"). O tempo vem de fora
 * (`agora`, em milissegundos), o que deixa a conta testável. `reiniciar` marca o começo de uma gravação.
 */
export class DetectorDeSom {
  private ultimoSom = 0;
  constructor(
    private readonly limiar = LIMIAR_SOM,
    private readonly silencioMs = SILENCIO_MS,
  ) {}

  reiniciar(agora: number): void {
    this.ultimoSom = agora;
  }

  atualizar(nivel: number, agora: number): { comSom: boolean; semSom: boolean } {
    const comSom = nivel >= this.limiar;
    if (comSom) this.ultimoSom = agora;
    return { comSom, semSom: agora - this.ultimoSom >= this.silencioMs };
  }
}
