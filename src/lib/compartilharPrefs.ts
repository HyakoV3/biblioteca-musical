// O formato do arquivo que a gravação leva ao ser enviada, quando o áudio é WebM: ".webm" (o mais aceito) ou ".weba" (a extensão própria do WebM só com áudio). É o MESMO conteúdo, só muda o nome do arquivo.
// A escolha é lembrada neste aparelho (localStorage) e SEMPRE validada ao ler; uma falha de armazenamento é ignorada.
export type FormatoWebm = "webm" | "weba";
export const CHAVE_COMPARTILHAR = "prefs.compartilhar";
export const FORMATO_PADRAO: FormatoWebm = "webm";

export function formatoValido(v: unknown): v is FormatoWebm {
  return v === "webm" || v === "weba";
}

export function lerFormatoWebm(): FormatoWebm {
  try {
    const bruto = localStorage.getItem(CHAVE_COMPARTILHAR);
    const o = bruto ? (JSON.parse(bruto) as unknown) : null;
    const v = o && typeof o === "object" ? (o as Record<string, unknown>).webm : null;
    return formatoValido(v) ? v : FORMATO_PADRAO;
  } catch {
    return FORMATO_PADRAO;
  }
}

export function salvarFormatoWebm(f: FormatoWebm): void {
  try {
    localStorage.setItem(CHAVE_COMPARTILHAR, JSON.stringify({ webm: f }));
  } catch {
    // sem armazenamento: o app segue com a escolha na memória
  }
}
