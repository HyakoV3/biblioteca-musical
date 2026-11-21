import { ErroPacote } from "../sons/extrair";

/**
 * Os bytes do arquivo conferido viram o texto do `hinario.json` (UTF-8, sem aceitar bytes inválidos) que o Rust valida e instala. Bytes que não são UTF-8 saem como
 * `ErroPacote("integridade")` (a tela o traduz), e não como o `TypeError` cru do navegador.
 */
export function textoDoHinario(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    throw new ErroPacote("integridade", `o arquivo não é UTF-8: ${String(e)}`);
  }
}
