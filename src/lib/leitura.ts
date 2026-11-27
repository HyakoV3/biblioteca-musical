// Como a letra é mostrada (I-04): tamanho e alinhamento, lembrados no aparelho. Regras puras, sem acesso ao armazenamento.

/** Escalas do texto da letra, de 85% a 160% do padrão, em 6 passos. Multiplicam o tamanho de base (que já segue a fonte do sistema). */
export const ESCALAS_LETRA = [0.85, 1, 1.15, 1.3, 1.45, 1.6] as const;
/** Índice do tamanho padrão (100%). */
export const PASSO_PADRAO = 1;

export const ALINHAMENTOS = ["esquerda", "centro", "direita"] as const;
export type Alinhamento = (typeof ALINHAMENTOS)[number];

export type Leitura = { passo: number; alinhamento: Alinhamento };

export const leituraPadrao = (): Leitura => ({ passo: PASSO_PADRAO, alinhamento: "esquerda" });

/** Mantém o passo dentro dos limites; valor inválido (NaN, texto) volta ao padrão. */
export function limitarPasso(p: unknown): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return PASSO_PADRAO;
  return Math.min(ESCALAS_LETRA.length - 1, Math.max(0, Math.round(p)));
}

export const escalaDoPasso = (passo: number): number => ESCALAS_LETRA[limitarPasso(passo)];

/** Aceita o que veio do armazenamento (qualquer coisa) e devolve uma leitura válida: o que não serve volta ao padrão. */
export function normalizarLeitura(bruto: unknown): Leitura {
  const base = leituraPadrao();
  if (typeof bruto !== "object" || bruto === null) return base;
  const { passo, alinhamento } = bruto as Record<string, unknown>;
  // O alinhamento "justificado" foi trocado por "centro": quem o tinha salvo passa a ver a letra centralizada.
  const nome = alinhamento === "justificado" ? "centro" : alinhamento;
  return {
    passo: limitarPasso(passo),
    alinhamento: ALINHAMENTOS.find((a) => a === nome) ?? base.alinhamento,
  };
}
