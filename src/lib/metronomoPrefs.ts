// O que o metrônomo lembra (I-20): o último andamento e compasso usados e a lista dos últimos (sem repetir, o mais recente no topo). Guardado no aparelho
// (localStorage) e SEMPRE validado ao ler: qualquer valor fora da faixa volta ao padrão, e uma falha de armazenamento é ignorada.
import { BPM_PADRAO, COMPASSO_PADRAO, compassoValido, limitarBpm } from "./metronomo";

export type Recente = { bpm: number; compasso: number };
export type PrefMetronomo = { bpm: number; compasso: number; recentes: Recente[] };

export const CHAVE_METRONOMO = "prefs.metronomo";
export const RECENTES_MAX = 10;

export const prefPadrao = (): PrefMetronomo => ({ bpm: BPM_PADRAO, compasso: COMPASSO_PADRAO, recentes: [] });

const ehNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function lerRecente(v: unknown): Recente | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!ehNumero(o.bpm) || !compassoValido(o.compasso)) return null;
  return { bpm: limitarBpm(o.bpm), compasso: o.compasso };
}

/** Põe `item` no topo da lista, sem repetir (o mesmo andamento e compasso sobe em vez de duplicar) e com no máximo `RECENTES_MAX`. */
export function adicionarRecente(lista: readonly Recente[], item: Recente): Recente[] {
  const sem = lista.filter((r) => !(r.bpm === item.bpm && r.compasso === item.compasso));
  return [item, ...sem].slice(0, RECENTES_MAX);
}

export function normalizarPref(bruto: unknown): PrefMetronomo {
  const p = prefPadrao();
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return p;
  const o = bruto as Record<string, unknown>;
  if (ehNumero(o.bpm)) p.bpm = limitarBpm(o.bpm);
  if (compassoValido(o.compasso)) p.compasso = o.compasso;
  if (Array.isArray(o.recentes)) {
    for (const r of o.recentes) {
      const ok = lerRecente(r);
      if (ok) p.recentes = adicionarRecente(p.recentes.slice().reverse(), ok).reverse().slice(0, RECENTES_MAX);
    }
  }
  return p;
}

export function lerMetronomo(): PrefMetronomo {
  try {
    const bruto = localStorage.getItem(CHAVE_METRONOMO);
    return normalizarPref(bruto ? JSON.parse(bruto) : null);
  } catch {
    return prefPadrao();
  }
}

export function salvarMetronomo(p: PrefMetronomo): void {
  try {
    localStorage.setItem(CHAVE_METRONOMO, JSON.stringify(p));
  } catch {
    // sem armazenamento: o app segue com o que tem na memória
  }
}
