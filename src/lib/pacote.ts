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

/**
 * A barra única dos pacotes baixáveis (hinário, partituras e sons): o download vale os primeiros 90% (0 a 90%) e o resto é a conferência e a
 * instalação. Assim a barra não fica parada em 100% enquanto o app ainda trabalha. `progresso` é o andamento do download (0 a 1).
 */
export const PARTE_DO_DOWNLOAD = 0.9;
export function progressoTotal(fase: "baixando" | "conferindo" | "instalando" | "ocioso" | "erro", progresso: number): number {
  // Os marcos de depois do download saem do que sobra da barra (30% e 60% do resto), para seguirem `PARTE_DO_DOWNLOAD` se ela mudar.
  const resto = 1 - PARTE_DO_DOWNLOAD;
  if (fase === "baixando") return (Number.isNaN(progresso) ? 0 : Math.min(1, Math.max(0, progresso))) * PARTE_DO_DOWNLOAD; // NaN (total desconhecido) vira 0
  if (fase === "conferindo") return PARTE_DO_DOWNLOAD + resto * 0.3;
  if (fase === "instalando") return PARTE_DO_DOWNLOAD + resto * 0.6;
  return 0;
}
/** O mesmo, em porcentagem inteira, para o texto "Baixando 45%". */
export const porcentagemTotal = (fase: Parameters<typeof progressoTotal>[0], progresso: number): number => Math.round(progressoTotal(fase, progresso) * 100);

/** "1, 5, 283" para os primeiros números e "…" se houver mais (a lista de partituras recusadas pode ter centenas). */
export function listaCurta(numeros: number[], maximo = 8): string {
  const inicio = numeros.slice(0, maximo).join(", ");
  return numeros.length > maximo ? `${inicio}…` : inicio;
}
