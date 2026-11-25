// Preferências por voz, guardadas no aparelho (localStorage): instrumento, volume e silenciar.
// A chave é o tipo da voz (soprano, contralto, tenor, baixo) ou, se não for reconhecido, o nome.
// Tudo é validado ao ler e qualquer falha de armazenamento é ignorada (o app segue com o padrão).

import { INSTRUMENTOS, ORGAOS, PADRAO, instrumentosDaVoz, tipoDaVoz, type InstrumentoId } from "./instrumentos";
import { leituraPadrao, normalizarLeitura, type Leitura } from "./leitura";
import { ZOOM_PADRAO, escalaDoZoom, normalizarZoom } from "./partitura";
import { IDS_REALISTAS, ehRealista } from "./realista";

export type PrefVoz = { instrumento: InstrumentoId; volume: number; muda: boolean };

const CHAVE = "prefs.vozes";

export const padrao = (): PrefVoz => ({ instrumento: PADRAO, volume: 1, muda: false });

const chaveDaVoz = (nome: string) => tipoDaVoz(nome) ?? `nome:${nome.trim().toLowerCase()}`;

function lerTudo(): Record<string, unknown> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const obj = bruto ? JSON.parse(bruto) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Preferência salva para a voz, já validada; instrumento fora da faixa da voz volta ao padrão. */
export function lerVoz(nome: string): PrefVoz {
  const p = padrao();
  const salvo = lerTudo()[chaveDaVoz(nome)];
  if (!salvo || typeof salvo !== "object") return p;
  const s = salvo as Record<string, unknown>;
  const permitidos: string[] = [...ORGAOS, ...instrumentosDaVoz(nome), ...IDS_REALISTAS];
  // A flauta doce sintetizada virou flauta transversal (2026-11-25): quem a tinha escolhida fica com a flauta.
  const salvoId = s.instrumento === "flauta_doce" ? "flauta" : s.instrumento;
  if (typeof salvoId === "string" && (salvoId in INSTRUMENTOS || ehRealista(salvoId)) && permitidos.includes(salvoId)) {
    p.instrumento = salvoId as InstrumentoId;
  }
  if (typeof s.volume === "number" && Number.isFinite(s.volume)) p.volume = Math.min(1, Math.max(0, s.volume));
  if (typeof s.muda === "boolean") p.muda = s.muda;
  return p;
}

/** Quais cards do player ficam abertos. O card "Tocar" é fixo e não entra aqui. */
export type Cartoes = { ajustes: boolean; vozes: boolean; instrumentos: boolean };

const CHAVE_CARTOES = "prefs.cartoes";

/** Padrão: só as vozes (volume e silenciar, que se usa tocando) ficam abertas. Só um card fica aberto por vez. */
export const cartoesPadrao = (): Cartoes => ({ ajustes: false, vozes: true, instrumentos: false });

export function lerCartoes(): Cartoes {
  const p = cartoesPadrao();
  try {
    const bruto = localStorage.getItem(CHAVE_CARTOES);
    const o = bruto ? JSON.parse(bruto) : null;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const k of Object.keys(p) as (keyof Cartoes)[]) if (typeof o[k] === "boolean") p[k] = o[k];
    }
    // Os cards são um grupo exclusivo: se o salvo tiver mais de um aberto (de uma versão anterior), vale o primeiro por
    // prioridade (vozes, andamento e tom, instrumentos). Nenhum aberto é permitido.
    const ordem: (keyof Cartoes)[] = ["vozes", "ajustes", "instrumentos"];
    const primeiro = ordem.find((k) => p[k]);
    for (const k of ordem) p[k] = k === primeiro;
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

const CHAVE_KARAOKE = "prefs.karaoke";

/** Karaokê da letra ligado? Padrão: ligado (só tem efeito nos hinos que trazem a sincronia). */
export function lerKaraoke(): boolean {
  try {
    const v = localStorage.getItem(CHAVE_KARAOKE);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function salvarKaraoke(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_KARAOKE, ligado ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

const CHAVE_CIENTE = "prefs.aviso-independente";

/** A pessoa já disse "Concordo" ao aviso de que o app é independente e não oficial (Ajustes)? */
export function lerCiente(): boolean {
  try {
    return localStorage.getItem(CHAVE_CIENTE) === "1";
  } catch {
    return false;
  }
}

export function salvarCiente() {
  try {
    localStorage.setItem(CHAVE_CIENTE, "1");
  } catch {
    /* sem armazenamento: o aviso volta na próxima abertura */
  }
}

const CHAVE_TELA = "prefs.manter-tela";

/** Manter a tela ligada enquanto o hino toca? Padrão: desligado (gasta bateria). */
export function lerManterTela(): boolean {
  try {
    return localStorage.getItem(CHAVE_TELA) === "1";
  } catch {
    return false;
  }
}

export function salvarManterTela(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_TELA, ligado ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

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

/** Salva as preferências de várias vozes de uma vez (uma gravação). */
export function salvarVozes(lista: { nome: string; pref: PrefVoz }[]) {
  try {
    const tudo = lerTudo();
    for (const { nome, pref } of lista) tudo[chaveDaVoz(nome)] = pref;
    localStorage.setItem(CHAVE, JSON.stringify(tudo));
  } catch {
    /* sem armazenamento: as escolhas valem só nesta sessão */
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

/** Quais cartões de Ajustes ficam abertos. Sobre e Créditos não entram: abrem sempre fechados. */
export type AjustesAbertos = { aparencia: boolean; idioma: boolean; conteudo: boolean };

const CHAVE_AJUSTES = "prefs.ajustes";

/** Padrão: todos fechados, cada um com o estado na linha de cima. */
export const ajustesPadrao = (): AjustesAbertos => ({ aparencia: false, idioma: false, conteudo: false });

export function lerAjustes(): AjustesAbertos {
  const p = ajustesPadrao();
  try {
    const bruto = localStorage.getItem(CHAVE_AJUSTES);
    const o = bruto ? JSON.parse(bruto) : null;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const k of Object.keys(p) as (keyof AjustesAbertos)[]) if (typeof o[k] === "boolean") p[k] = o[k];
    }
  } catch {
    /* sem armazenamento ou JSON inválido: vale o padrão */
  }
  return p;
}

export function salvarAjustes(a: AjustesAbertos) {
  try {
    localStorage.setItem(CHAVE_AJUSTES, JSON.stringify({ aparencia: a.aparencia, idioma: a.idioma, conteudo: a.conteudo }));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** O interruptor ".webm | .weba" do Enviar saiu (a gravação em WebM agora vai como Ogg): apaga a escolha que ele guardava. */
export function limparEscolhaAntigaDoFormato(): void {
  try {
    localStorage.removeItem("prefs.compartilhar");
  } catch {
    // sem armazenamento: nada a limpar
  }
}

const CHAVE_ULTIMO = "prefs.ultimo-hino";

/** O número do último hino aberto (I-17), ou `null` se não há nenhum ou o valor guardado é inválido. */
export function lerUltimoHino(): number | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ULTIMO);
    if (bruto === null) return null;
    const n = Number(bruto);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function salvarUltimoHino(numero: number) {
  try {
    localStorage.setItem(CHAVE_ULTIMO, String(numero));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

const CHAVE_RUIDO = "prefs.reduzir-ruido";

/** Gravar com a redução de ruído do aparelho (I-29)? Padrão: desligada, para o som sair como foi tocado ou cantado. */
export function lerReduzirRuido(): boolean {
  try {
    return localStorage.getItem(CHAVE_RUIDO) === "1";
  } catch {
    return false;
  }
}

export function salvarReduzirRuido(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_RUIDO, ligado ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

