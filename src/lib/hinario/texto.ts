/** Os bytes do arquivo conferido viram o texto do `hinario.json` (UTF-8, sem aceitar bytes inválidos) que o Rust valida e instala. */
export const textoDoHinario = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
