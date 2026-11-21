// O que o afinador lembra: a lista das últimas notas dadas em "Outra nota" (sem repetir, a mais recente no topo), no mesmo molde do metrônomo (`metronomoPrefs.ts`).
// Guardado no aparelho (localStorage) e SEMPRE validado ao ler: valor fora da faixa é descartado, e uma falha de armazenamento é ignorada.
import { OITAVA_MAX, OITAVA_MIN } from "./afinador";

export type NotaRecente = { classe: number; oitava: number };
export type PrefAfinador = { recentes: NotaRecente[] };

export const CHAVE_AFINADOR = "prefs.afinador";
export const RECENTES_MAX = 10;

const inteiro = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function lerNota(v: unknown): NotaRecente | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return inteiro(o.classe, 0, 11) && inteiro(o.oitava, OITAVA_MIN, OITAVA_MAX) ? { classe: o.classe, oitava: o.oitava } : null;
}

/** Põe `nota` no topo, sem repetir (a mesma nota e oitava sobe em vez de duplicar), com no máximo `RECENTES_MAX`. */
export function adicionarNota(lista: readonly NotaRecente[], nota: NotaRecente): NotaRecente[] {
  return [nota, ...lista.filter((n) => !(n.classe === nota.classe && n.oitava === nota.oitava))].slice(0, RECENTES_MAX);
}

export function normalizarPref(bruto: unknown): PrefAfinador {
  const recentes: NotaRecente[] = [];
  if (bruto && typeof bruto === "object" && !Array.isArray(bruto) && Array.isArray((bruto as Record<string, unknown>).recentes)) {
    for (const r of (bruto as { recentes: unknown[] }).recentes) {
      const n = lerNota(r);
      if (n && !recentes.some((x) => x.classe === n.classe && x.oitava === n.oitava) && recentes.length < RECENTES_MAX) recentes.push(n); // a ordem salva é a do topo para baixo
    }
  }
  return { recentes };
}

export function lerAfinador(): PrefAfinador {
  try {
    const bruto = localStorage.getItem(CHAVE_AFINADOR);
    return normalizarPref(bruto ? JSON.parse(bruto) : null);
  } catch {
    return { recentes: [] };
  }
}

export function salvarAfinador(p: PrefAfinador): void {
  try {
    localStorage.setItem(CHAVE_AFINADOR, JSON.stringify(p));
  } catch {
    // sem armazenamento: o app segue com o que tem na memória
  }
}
