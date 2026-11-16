// Pacote de partituras (.zip só com partituras/hino-N.svg, baixado do servidor) e importação do hinário (.json): o que o app decide antes de
// chamar o Rust. O conteúdo do zip é conferido no Rust (src-tauri/src/pacote.rs); aqui só se prepara o envio.

/** Tamanho máximo do hinario.json importado, em bytes. É o mesmo limite do Rust (`hinario::LIMITE_BYTES`, 20 MiB). Conferido em Ajustes pelo
 *  `file.size`, ANTES de ler o arquivo para a memória. */
export const LIMITE_JSON_BYTES = 20 * 1024 * 1024;

/** Tamanho máximo do zip de partituras, em bytes. É o mesmo limite do Rust (`Limites::zip`, 150 MiB). Conferido em `importarPartituras`, antes
 *  de montar o texto base64 (4/3 do tamanho) e a cópia dele no `postMessage` (o download já é cortado em 100 MiB em `sons/extrair.ts`). */
export const LIMITE_ZIP_BYTES = 150 * 1024 * 1024;

/**
 * Os bytes em base64, que é como o zip vai ao Rust. Não pode ser corpo binário: no Android o Tauri não entrega `InvokeBody::Raw`
 * (só o `postMessage`, que é texto). Converte em pedaços: `String.fromCharCode(...bytes)` com 15 MB estoura a pilha.
 */
export function bytesParaBase64(bytes: Uint8Array): string {
  // Um pedaço de 3 em 3 bytes (múltiplo de 3) deixa cada pedaço virar base64 sem preenchimento no meio.
  const PEDACO = 3 * 10922; // 32766 bytes (múltiplo de 3 de verdade: tests/pacote.test.ts confere os tamanhos em volta dele)
  let saida = "";
  for (let i = 0; i < bytes.length; i += PEDACO) {
    let binario = "";
    const fim = Math.min(i + PEDACO, bytes.length);
    for (let j = i; j < fim; j++) binario += String.fromCharCode(bytes[j]);
    saida += btoa(binario);
  }
  return saida;
}

/** "1, 5, 283" para os primeiros números e "…" se houver mais (a lista de partituras recusadas pode ter centenas). */
export function listaCurta(numeros: number[], maximo = 8): string {
  const inicio = numeros.slice(0, maximo).join(", ");
  return numeros.length > maximo ? `${inicio}…` : inicio;
}
