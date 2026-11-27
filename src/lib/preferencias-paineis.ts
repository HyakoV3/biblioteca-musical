// Quais painéis ficam abertos, guardados no aparelho (localStorage): os cards do player e os cartões de Ajustes.
// O que estiver inválido no armazenamento volta ao padrão, e qualquer falha de armazenamento é ignorada.

/** Quais cards do player ficam abertos. O card "Tocar" é fixo e não entra aqui. */
export type Cartoes = { ajustes: boolean; vozes: boolean; instrumentos: boolean };

const CHAVE_CARTOES = "prefs.cartoes";

/** Padrão: só as vozes (volume e silenciar, que se usa tocando) ficam abertas. Só um card fica aberto por vez. */
export const cartoesPadrao = (): Cartoes => ({ ajustes: false, vozes: true, instrumentos: false });

/** Copia para `alvo` os campos booleanos que `salvo` traz com o mesmo nome; o resto (e um `salvo` que não é objeto) é ignorado. */
function aplicarBooleanos<T extends Record<string, boolean>>(alvo: T, salvo: unknown): void {
  if (!salvo || typeof salvo !== "object" || Array.isArray(salvo)) return;
  const o = salvo as Record<string, unknown>;
  for (const k of Object.keys(alvo) as (keyof T & string)[]) {
    const v = o[k];
    if (typeof v === "boolean") alvo[k] = v as T[typeof k];
  }
}

/** O JSON guardado em `chave`, ou `null` se não há nada; lança se o JSON for inválido ou o armazenamento falhar. */
function lerJson(chave: string): unknown {
  const bruto = localStorage.getItem(chave);
  return bruto ? JSON.parse(bruto) : null;
}

/**
 * Os cards são um grupo exclusivo: se o salvo tiver mais de um aberto (de uma versão anterior), vale o primeiro por
 * prioridade (vozes, andamento e tom, instrumentos). Nenhum aberto é permitido.
 */
function deixarUmAberto(c: Cartoes): void {
  const ordem: (keyof Cartoes)[] = ["vozes", "ajustes", "instrumentos"];
  const primeiro = ordem.find((k) => c[k]);
  for (const k of ordem) c[k] = k === primeiro;
}

export function lerCartoes(): Cartoes {
  const p = cartoesPadrao();
  try {
    aplicarBooleanos(p, lerJson(CHAVE_CARTOES));
    deixarUmAberto(p);
  } catch {
    /* sem armazenamento ou JSON inválido: vale o padrão */
  }
  return p;
}

export function salvarCartoes(c: Cartoes) {
  try {
    localStorage.setItem(CHAVE_CARTOES, JSON.stringify(c));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Quais cartões de Ajustes ficam abertos. Sobre e Créditos não entram: abrem sempre fechados. */
export type AjustesAbertos = { aparencia: boolean; idioma: boolean; conteudo: boolean };

const CHAVE_AJUSTES = "prefs.ajustes";

/** Padrão: todos fechados, cada um com o estado na linha de cima. */
export const ajustesPadrao = (): AjustesAbertos => ({ aparencia: false, idioma: false, conteudo: false });

export function lerAjustes(): AjustesAbertos {
  const p = ajustesPadrao();
  try {
    aplicarBooleanos(p, lerJson(CHAVE_AJUSTES));
  } catch {
    /* sem armazenamento ou JSON inválido: vale o padrão */
  }
  return p;
}

export function salvarAjustes(a: AjustesAbertos) {
  const { aparencia, idioma, conteudo } = a;
  try {
    localStorage.setItem(CHAVE_AJUSTES, JSON.stringify({ aparencia, idioma, conteudo }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
