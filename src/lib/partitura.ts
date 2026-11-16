// A partitura no hino (I-08): quando a aba aparece e o zoom. Regras puras, sem acesso ao armazenamento nem ao Rust.

/**
 * O que o hino tem de partitura, a partir de quais hinos o pacote importado trouxe (`Pacote.partituras`):
 *  - `tem`: este hino tem partitura;
 *  - `sem_pacote`: nenhum hino tem (nunca se importou um pacote `.zip` com partituras): a aba aparece com um aviso e um botão
 *    para Ajustes, onde se importa o pacote;
 *  - `nao_tem`: o pacote tem partituras, mas não deste hino: a aba não aparece (nada a mostrar nem a pedir).
 */
export type EstadoPartitura = "tem" | "sem_pacote" | "nao_tem";

export function estadoDaPartitura(partituras: readonly number[], numero: number): EstadoPartitura {
  if (partituras.includes(numero)) return "tem";
  return partituras.length === 0 ? "sem_pacote" : "nao_tem";
}

/** A aba Partitura existe neste hino? Sim quando tem partitura e quando nenhum pacote foi importado (aí é o aviso). */
export const temAbaPartitura = (estado: EstadoPartitura): boolean => estado !== "nao_tem";

/** Tamanhos da partitura, de 100% a 400% da largura da tela, em 6 passos (o 100% cabe na largura, sem rolar de lado). */
export const ESCALAS_PARTITURA = [1, 1.25, 1.5, 2, 3, 4] as const;
/** Índice do tamanho padrão (100%). */
export const ZOOM_PADRAO = 0;

/** Mantém o passo dentro dos limites; valor inválido (NaN, texto) volta ao padrão. */
export function limitarZoom(p: unknown): number {
  if (typeof p !== "number" || !Number.isFinite(p)) return ZOOM_PADRAO;
  return Math.min(ESCALAS_PARTITURA.length - 1, Math.max(0, Math.round(p)));
}

export const escalaDoZoom = (passo: number): number => ESCALAS_PARTITURA[limitarZoom(passo)];

/** Aceita o que veio do armazenamento (qualquer coisa) e devolve um passo válido. */
export function normalizarZoom(bruto: unknown): number {
  if (typeof bruto !== "object" || bruto === null) return ZOOM_PADRAO;
  return limitarZoom((bruto as Record<string, unknown>).zoom);
}
