// Baixar e instalar o pacote de partituras (I-08), no mesmo caminho dos sons gravados: baixa o zip pelo lado nativo, CONFERE o tamanho e o
// SHA-256 contra o manifesto e só então entrega ao Rust (que confere de novo nomes, limites e cada SVG). Funções injetadas, para o fluxo
// ser testado sem rede nem Tauri; o store (partituras.svelte.ts) liga as de verdade.
import { ErroPacote } from "../sons/extrair";
import type { PacotePartituras } from "./tipos";

export type Fase = "baixando" | "conferindo" | "instalando";

export type Dependencias<T> = {
  /** Baixa o zip inteiro, avisando o progresso (0 a 1). `estimativa` (bytes) vale quando o servidor não diz o tamanho. */
  baixar: (url: string, estimativa: number, aoProgredir: (fracao: number) => void) => Promise<Uint8Array>;
  sha256: (dados: Uint8Array) => Promise<string>;
  /** Entrega o zip conferido ao Rust. */
  instalar: (zip: Uint8Array) => Promise<T>;
};

/**
 * O pacote só é instalado se tiver EXATAMENTE o tamanho e o SHA-256 do manifesto: um arquivo adulterado, incompleto ou trocado no servidor
 * é descartado (`ErroPacote("integridade")`) e nada chega ao Rust. Erros de rede saem como `ErroPacote("rede")` de `baixar`.
 */
export async function baixarEInstalar<T>(
  pacote: PacotePartituras,
  dep: Dependencias<T>,
  aoMudar: (fase: Fase, progresso: number) => void,
): Promise<T> {
  aoMudar("baixando", 0);
  const zip = await dep.baixar(pacote.url, pacote.bytes, (f) => aoMudar("baixando", f));
  aoMudar("conferindo", 1);
  if (zip.length !== pacote.bytes) throw new ErroPacote("integridade", `tamanho ${zip.length}, esperado ${pacote.bytes}`);
  if ((await dep.sha256(zip)) !== pacote.sha256.toLowerCase()) throw new ErroPacote("integridade", "sha256 diferente do manifesto");
  aoMudar("instalando", 1);
  return dep.instalar(zip);
}
