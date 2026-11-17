// I-23: nivelar cada nota dos instrumentos GRAVADOS. Cada gravado tem um ganho só (`ganho` em realista.ts), mas dentro do instrumento as
// notas variam de 2,5 a 10 dB (o agudo mais forte), e com quatro vozes juntas o equilíbrio entre elas muda a cada nota.
// `niveis-gravados.json` guarda, por gravado e por nota, a correção em dB que leva a nota ao nível médio do instrumento. É gerado por
// `tools/analisar-timbres.py --fonte <amostras> --mapa-notas --escrever` e se refaz quando as amostras mudarem (como os ganhos).
//
// A correção é aplicada pela `velocity` do smplr: o ganho dele é velocity²/16129, então 40·log10(velocity/90) dB em relação a 90, que é a
// velocity de antes. Não precisa de nó de áudio por nota. (No preset do Soundfont a velocity só muda o ganho: cada nota é uma região só,
// sem faixas de velocity, então a amostra tocada é a mesma.)
import dados from "./niveis-gravados.json";
import type { RealistaId } from "./realista";

/** A `velocity` que o app usa sem correção. */
export const VELOCIDADE_BASE = 90;
/** Acima de 127 nenhuma região do banco casa e a nota fica MUDA; o reforço máximo é então 40·log10(127/90) = +5,99 dB. */
export const VELOCIDADE_MAXIMA = 127;
export const VELOCIDADE_MINIMA = 1;

type Tabela = { de: number; db: readonly number[] };
const TABELAS = dados.instrumentos as unknown as Record<string, Tabela>;

/** Os gravados que têm tabela (para conferir que o arquivo está em dia com o catálogo). */
export const IDS_COM_NIVEIS: readonly string[] = Object.keys(TABELAS);

/**
 * Correção, em dB, do nível da nota `midi` do gravado `id`. `midi` é a altura que SOA (já transposta), porque o nível é uma propriedade
 * da amostra tocada. Sem tabela (ou nota inválida) vale 0; fora da faixa medida vale o da borda mais próxima.
 */
export function correcaoDb(id: RealistaId, midi: number): number {
  const t = TABELAS[id];
  if (!t || t.db.length === 0 || !Number.isFinite(midi)) return 0;
  const i = Math.min(t.db.length - 1, Math.max(0, Math.round(midi) - t.de));
  return t.db[i];
}

/** A `velocity` que produz a correção `db` em relação à base, limitada a 1..127 (o smplr: ganho = velocity²/16129, ou seja, 40·log10(v/90) dB). */
export function velocidadeParaCorrecao(db: number): number {
  const v = VELOCIDADE_BASE * 10 ** (db / 40);
  return Math.min(VELOCIDADE_MAXIMA, Math.max(VELOCIDADE_MINIMA, v));
}

/** A `velocity` do smplr para tocar `midi` no gravado `id`: a base sem nivelar, e a corrigida com nivelar. */
export function velocidadeDaNota(id: RealistaId, midi: number, nivelar: boolean): number {
  return nivelar ? velocidadeParaCorrecao(correcaoDb(id, midi)) : VELOCIDADE_BASE;
}
