// Pacote de hinário em .zip (hinario.json + partituras/hino-N.svg): o que a tela de importação decide antes de chamar o Rust.
// O conteúdo do zip é conferido no Rust (src-tauri/src/pacote.rs); aqui só se distingue um zip de um JSON e se prepara o envio.

/** Tamanho máximo do zip, em bytes. É o mesmo limite do Rust (`Limites::zip`, 150 MiB). Conferido em dois pontos: na tela de Ajustes, pelo
 *  `file.size`, ANTES de ler o arquivo para a memória (aí um arquivo enorme nem é aberto), e de novo em `importarZip`, antes de montar o
 *  texto base64 (4/3 do tamanho) e a cópia dele no `postMessage`. */
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

/** O arquivo é um zip? Pelos primeiros bytes ("PK" e o código de entrada local ou de zip vazio), não pelo nome: o seletor de arquivos
 *  do Android nem sempre entrega a extensão. */
export function ehZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const par = (bytes[2] << 8) | bytes[3];
  return par === 0x0304 || par === 0x0506;
}
