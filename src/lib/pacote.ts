// Pacote de hinário em .zip (hinario.json + partituras/hino-N.svg): o que a tela de importação decide antes de chamar o Rust.
// O conteúdo do zip é conferido no Rust (src-tauri/src/pacote.rs); aqui só se distingue um zip de um JSON.

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
