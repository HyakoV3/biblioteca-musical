// Preferências do app guardadas no aparelho (localStorage). Tudo é validado ao ler e qualquer falha de armazenamento é ignorada (o app segue com o
// padrão). As de voz, as dos painéis abertos e as da leitura ficam em `preferencias-voz.ts`, `preferencias-paineis.ts` e `preferencias-leitura.ts`; este módulo as reexporta, e quem
// importa daqui não percebe a divisão.

import { FILTRO_PADRAO, lerFiltro, type FiltroDeRuido } from "./filtroDeRuido";

export { lerVoz, padrao, salvarVozes, type PrefVoz } from "./preferencias-voz";
export { lerLeitura, lerZoomPartitura, salvarLeitura, salvarZoomPartitura } from "./preferencias-leitura";
export {
  ajustesPadrao,
  cartoesPadrao,
  lerAjustes,
  lerCartoes,
  salvarAjustes,
  salvarCartoes,
  type AjustesAbertos,
  type Cartoes,
} from "./preferencias-paineis";

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

/** O filtro de ruído do Gravador (I-29). Padrão: desligado, para o som sair como foi tocado ou cantado. O formato antigo (uma caixa: "1" ligada) vale "android". */
export function lerFiltroDeRuido(): FiltroDeRuido {
  try {
    return lerFiltro(localStorage.getItem(CHAVE_RUIDO));
  } catch {
    return FILTRO_PADRAO;
  }
}

export function salvarFiltroDeRuido(filtro: FiltroDeRuido) {
  try {
    localStorage.setItem(CHAVE_RUIDO, filtro);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

