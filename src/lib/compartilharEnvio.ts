// O envio em si do `compartilhar.ts`: entrega o áudio à ponte do Android (`BmCompartilhar`, em pedaços) ou à Web Share API, convertendo antes o WebM/Opus em Ogg/Opus.

import { webmParaOgg } from "./ogg";

export type Ponte = {
  comecar(nome: string, tipo: string): boolean;
  parte(base64: string): boolean;
  enviar(titulo: string): boolean;
  /** Com um texto (o contexto em Markdown) que vai junto do áudio. Ponte antiga, sem este método: o texto não vai. */
  enviarComTexto?(titulo: string, texto: string): boolean;
  /** O contexto do último envio foi copiado para a área de transferência? Ponte antiga, sem este método: não. */
  getCopiouContexto?(): boolean;
  cancelar(): void;
  /** Apaga as cópias de gravações enviadas que ficaram no cache do app. Ponte antiga, sem este método: nada a apagar. */
  limparTudo?(): boolean;
};

export type Resultado = "ok" | "cancelado" | "erro";

/** O que vai para o envio: o áudio, o nome do arquivo, o título da folha e o texto opcional (o contexto em Markdown). `original`: o áudio de antes da conversão, para o caso de o navegador não aceitar o convertido. */
type Envio = { blob: Blob; nome: string; titulo: string; texto?: string; original?: Envio };

/** Múltiplo de 3 bytes (o base64 de cada pedaço não leva preenchimento no meio); 192 KiB por chamada à ponte. */
export const BYTES_POR_PEDACO = 3 * 65536;

export const ponte = (): Ponte | null => (globalThis as { BmCompartilhar?: Ponte }).BmCompartilhar ?? null;

/** "audio/webm;codecs=opus" → "audio/webm". */
export function tipoSemCodec(tipo: string): string {
  return tipo.split(";")[0]!.trim().toLowerCase() || "audio/*";
}

function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Áudio WebM/Opus vira Ogg/Opus (sem recodificar): é o que o WhatsApp, o Telegram e os outros aceitam como áudio. Se não der, segue o original. */
async function prepararOgg(blob: Blob, nome: string): Promise<{ blob: Blob; nome: string } | null> {
  if (!tipoSemCodec(blob.type).includes("webm")) return null;
  try {
    const ogg = webmParaOgg(new Uint8Array(await blob.arrayBuffer()));
    if (!ogg) return null;
    return { blob: new Blob([ogg as BlobPart], { type: "audio/ogg" }), nome: nome.replace(/\.(webm|weba)$/i, "") + ".ogg" };
  } catch (e) {
    console.warn("compartilhar: não foi possível converter para Ogg, enviando o original", e);
    return null;
  }
}

/** Entrega um pedaço à ponte. Se ela o recusar, cancela o envio e devolve falso. */
async function enviarPedaco(p: Ponte, pedaco: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await pedaco.arrayBuffer());
  if (p.parte(paraBase64(bytes))) return true;
  p.cancelar();
  return false;
}

/** Lê o blob em pedaços e entrega cada um (em base64) à ponte, parando no primeiro que ela recusar. */
async function enviarPedacos(p: Ponte, blob: Blob): Promise<boolean> {
  let ok = true;
  for (let i = 0; ok && i < blob.size; i += BYTES_POR_PEDACO) ok = await enviarPedaco(p, blob.slice(i, i + BYTES_POR_PEDACO));
  return ok;
}

/** Pede à ponte para abrir a folha: com o texto, se ela sabe levá-lo (ponte antiga: sem o texto). */
function abrirFolha(p: Ponte, { titulo, texto }: Envio): boolean {
  return texto && p.enviarComTexto ? p.enviarComTexto(titulo, texto) : p.enviar(titulo);
}

/** Cancela o envio na ponte; se ela já falhou, não há mais o que fazer. */
function cancelarSemFalhar(p: Ponte): void {
  try {
    p.cancelar();
  } catch {
    /* a ponte já falhou: nada mais a fazer */
  }
}

async function enviarPelaPonte(p: Ponte, envio: Envio): Promise<Resultado> {
  const tipo = tipoSemCodec(envio.blob.type); // sem parâmetros: o Intent do Android compara o tipo por igualdade com o que os apps declaram
  if (!p.comecar(envio.nome, tipo)) return "erro";
  try {
    if (!(await enviarPedacos(p, envio.blob))) return "erro";
    return abrirFolha(p, envio) ? "ok" : "erro";
  } catch (e) {
    // Falhou no meio (ler o pedaço, codificar): a ponte fecha o arquivo e apaga o que já tinha escrito.
    cancelarSemFalhar(p);
    throw e;
  }
}

const comoArquivo = ({ blob, nome }: Envio) => new File([blob], nome, { type: tipoSemCodec(blob.type) });

/** O arquivo para a Web Share: o convertido (Ogg) e, se o navegador não o aceitar, o original. */
function arquivoParaWebShare(envio: Envio): File {
  const arquivo = comoArquivo(envio);
  if (navigator.canShare?.({ files: [arquivo] }) || !envio.original) return arquivo;
  return comoArquivo(envio.original);
}

const textoDoEnvio = ({ texto }: Envio) => (texto ? { text: texto } : {});

async function enviarPelaWebShare(envio: Envio): Promise<Resultado> {
  const arquivo = arquivoParaWebShare(envio);
  if (!navigator.canShare?.({ files: [arquivo] })) return "erro";
  await navigator.share({ files: [arquivo], title: envio.titulo, ...textoDoEnvio(envio) });
  return "ok";
}

/** Converte (se der) e entrega o áudio à ponte do Android ou, sem ela, à Web Share. */
export async function enviarAgora(original: Envio): Promise<Resultado> {
  const conv = await prepararOgg(original.blob, original.nome);
  const envio = conv ? { ...original, ...conv, original } : original;
  try {
    const p = ponte();
    return p ? await enviarPelaPonte(p, envio) : await enviarPelaWebShare(envio);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    console.warn("compartilhar: falhou", e);
    return "erro";
  }
}
