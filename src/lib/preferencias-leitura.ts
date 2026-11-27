// Como a tela de leitura aparece, guardado no aparelho (localStorage): tamanho e alinhamento da letra e zoom da partitura.
// Valores inválidos voltam ao padrão e qualquer falha de armazenamento é ignorada.

import { leituraPadrao, normalizarLeitura, type Leitura } from "./leitura";
import { ZOOM_PADRAO, escalaDoZoom, normalizarZoom } from "./partitura";

const CHAVE_LEITURA = "prefs.letra";

/** Tamanho e alinhamento da letra (valem para todos os hinos). O que estiver inválido no armazenamento volta ao padrão. */
export function lerLeitura(): Leitura {
  try {
    const v = localStorage.getItem(CHAVE_LEITURA);
    return v === null ? leituraPadrao() : normalizarLeitura(JSON.parse(v));
  } catch {
    return leituraPadrao();
  }
}

export function salvarLeitura(l: Leitura) {
  try {
    localStorage.setItem(CHAVE_LEITURA, JSON.stringify(l));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

// Zoom da partitura (I-08): guarda a ESCALA (ver ESCALAS_PARTITURA), igual em todos os hinos; a leitura a converte de volta em passo.
const CHAVE_PARTITURA = "prefs.partitura";

export function lerZoomPartitura(): number {
  try {
    const v = localStorage.getItem(CHAVE_PARTITURA);
    return v === null ? ZOOM_PADRAO : normalizarZoom(JSON.parse(v));
  } catch {
    return ZOOM_PADRAO;
  }
}
export function salvarZoomPartitura(passo: number) {
  try {
    localStorage.setItem(CHAVE_PARTITURA, JSON.stringify({ escala: escalaDoZoom(passo) }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
