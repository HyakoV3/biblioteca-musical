// O que o afinador lembra: a lista das últimas notas dadas em "Outra nota" (sem repetir, a mais recente no topo) e o tempo do temporizador (até parar, 10, 20 ou 30 s), no mesmo molde do metrônomo (`metronomoPrefs.ts`).
// Guardado no aparelho (localStorage) e SEMPRE validado ao ler: valor fora da faixa é descartado, e uma falha de armazenamento é ignorada.
import { DESLOCAMENTO_ESCRITO, OITAVA_MAX, OITAVA_MIN, type Transposicao } from "./afinador";
import { LIMITES, type Limite } from "./contagem";

export type NotaRecente = { classe: number; oitava: number };
export type PrefAfinador = { recentes: NotaRecente[]; limite: Limite };

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

const limiteValido = (v: unknown): v is Limite => (LIMITES as readonly unknown[]).includes(v);

export function normalizarPref(bruto: unknown): PrefAfinador {
  const recentes: NotaRecente[] = [];
  const salvo = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Record<string, unknown>).limite : undefined;
  const limite: Limite = limiteValido(salvo) ? salvo : 0; // valor inválido ou ausente: "até parar", o padrão de sempre
  if (bruto && typeof bruto === "object" && !Array.isArray(bruto) && Array.isArray((bruto as Record<string, unknown>).recentes)) {
    for (const r of (bruto as { recentes: unknown[] }).recentes) {
      const n = lerNota(r);
      if (n && !recentes.some((x) => x.classe === n.classe && x.oitava === n.oitava) && recentes.length < RECENTES_MAX) recentes.push(n); // a ordem salva é a do topo para baixo
    }
  }
  return { recentes, limite };
}

export function lerAfinador(): PrefAfinador {
  try {
    const bruto = localStorage.getItem(CHAVE_AFINADOR);
    return normalizarPref(bruto ? JSON.parse(bruto) : null);
  } catch {
    return { recentes: [], limite: 0 };
  }
}

export function salvarAfinador(p: PrefAfinador): void {
  try {
    localStorage.setItem(CHAVE_AFINADOR, JSON.stringify(p));
  } catch {
    // sem armazenamento: o app segue com o que tem na memória
  }
}

// O instrumento de "Qual nota é essa?" (o que transpõe: a nota escrita para ele), à parte do resto das preferências do afinador.
export const CHAVE_INSTRUMENTO = "prefs.afinador.instrumento";
const INSTRUMENTOS = Object.keys(DESLOCAMENTO_ESCRITO) as Transposicao[];
export const ehInstrumento = (v: unknown): v is Transposicao => typeof v === "string" && (INSTRUMENTOS as string[]).includes(v);

/** O instrumento lembrado; sem nada guardado (ou com lixo), "concerto": mostra a nota que soa. */
export function lerInstrumento(): Transposicao {
  try {
    const v = localStorage.getItem(CHAVE_INSTRUMENTO);
    return ehInstrumento(v) ? v : "concerto";
  } catch {
    return "concerto";
  }
}

export function salvarInstrumento(v: Transposicao): void {
  try {
    localStorage.setItem(CHAVE_INSTRUMENTO, v);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}
