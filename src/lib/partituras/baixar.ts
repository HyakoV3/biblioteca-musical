// Baixar e instalar o pacote de partituras (I-08), no mesmo caminho dos sons gravados: baixa pelo lado nativo, CONFERE o tamanho e o
// SHA-256 contra o manifesto e só então entrega ao Rust (que confere de novo nomes, limites e cada SVG). Funções injetadas, para o fluxo
// ser testado sem rede nem Tauri; o store (partituras.svelte.ts) liga as de verdade.
import { extrairEConferir } from "../sons/extrair";
import type { PacotePartituras } from "./tipos";

export type Fase = "baixando" | "conferindo" | "instalando";

export type Dependencias<T> = {
  /** Baixa o que o link entrega, avisando o progresso (0 a 1). `estimativa` (bytes) vale quando o servidor não diz o tamanho. */
  baixar: (url: string, estimativa: number, aoProgredir: (fracao: number) => void) => Promise<Uint8Array>;
  sha256: (dados: Uint8Array) => Promise<string>;
  /** De uma PASTA em zip (o que o link de uma pasta compartilhada entrega), tira o zip das partituras conferido (tamanho e SHA-256). */
  extrairDaPasta: (pasta: Uint8Array, pacote: PacotePartituras) => Promise<Uint8Array>;
  /** Entrega o zip conferido ao Rust. */
  instalar: (zip: Uint8Array) => Promise<T>;
};

/**
 * O zip das partituras, conferido, a partir do que o servidor entregou. O link de um ARQUIVO entrega o próprio zip; o de uma PASTA (o caso do
 * File Browser) entrega a pasta inteira em zip, com o zip das partituras dentro. Nos dois casos só passa o que tem EXATAMENTE o tamanho e o
 * SHA-256 do manifesto (`ErroPacote("integridade")` senão).
 */
export async function zipConferido(baixado: Uint8Array, pacote: PacotePartituras, dep: Pick<Dependencias<unknown>, "sha256" | "extrairDaPasta">): Promise<Uint8Array> {
  if (baixado.length === pacote.bytes && (await dep.sha256(baixado)) === pacote.sha256.toLowerCase()) return baixado;
  return dep.extrairDaPasta(baixado, pacote);
}

/** A versão de verdade de `extrairDaPasta`: reaproveita a conferência dos sons (só abre o arquivo esperado, pelo nome, e confere tamanho e SHA-256). */
export async function extrairDaPastaReal(pasta: Uint8Array, pacote: PacotePartituras): Promise<Uint8Array> {
  const arquivos = await extrairEConferir(pasta, {
    id: "partituras",
    url: pacote.url,
    arquivos: [{ instrumento: "partituras", arquivo: pacote.arquivo, bytes: pacote.bytes, sha256: pacote.sha256.toLowerCase() }],
  });
  return arquivos.get(pacote.arquivo)!; // `extrairEConferir` já recusou (ErroPacote) se faltasse
}

/**
 * O pacote só é instalado se o zip tiver EXATAMENTE o tamanho e o SHA-256 do manifesto: um arquivo adulterado, incompleto ou trocado no
 * servidor é descartado (`ErroPacote`) e nada chega ao Rust. Erros de rede saem como `ErroPacote("rede")` de `baixar`.
 */
export async function baixarEInstalar<T>(
  pacote: PacotePartituras,
  dep: Dependencias<T>,
  aoMudar: (fase: Fase, progresso: number) => void,
): Promise<T> {
  aoMudar("baixando", 0);
  const baixado = await dep.baixar(pacote.url, pacote.bytes, (f) => aoMudar("baixando", f));
  aoMudar("conferindo", 1);
  const zip = await zipConferido(baixado, pacote, dep);
  aoMudar("instalando", 1);
  return dep.instalar(zip);
}
