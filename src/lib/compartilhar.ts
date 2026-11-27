// Compartilhar uma gravação pela folha de compartilhamento do sistema (a que mostra os apps mais usados: WhatsApp etc.). No Android a WebView não abre
// essa folha sozinha, então o app tem uma ponte (`PonteCompartilhar.kt`, `window.BmCompartilhar`) que recebe o áudio em pedaços e abre a folha.
// Fora do Android usa a Web Share API quando o navegador compartilha arquivos; sem nenhuma das duas, `podeCompartilhar()` é falso e o botão nem aparece.

import { webmParaOgg } from "./ogg";

type Ponte = {
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

/** Múltiplo de 3 bytes (o base64 de cada pedaço não leva preenchimento no meio); 192 KiB por chamada à ponte. */
export const BYTES_POR_PEDACO = 3 * 65536;

const ponte = (): Ponte | null => (globalThis as { BmCompartilhar?: Ponte }).BmCompartilhar ?? null;

/** "audio/webm;codecs=opus" → "audio/webm". */
export function tipoSemCodec(tipo: string): string {
  return tipo.split(";")[0]!.trim().toLowerCase() || "audio/*";
}

/** Nome do arquivo enviado: "gravacao-AAAA-MM-DD-HHMM.ext", com a extensão do formato. O áudio em WebM sai como ".ogg" (convertido em `prepararOgg`); o ".webm" só vale quando a conversão falha. */
export function nomeDoArquivo(criadaEm: number, tipo: string): string {
  const d = new Date(criadaEm);
  const dois = (n: number) => String(n).padStart(2, "0");
  const t = tipoSemCodec(tipo);
  const ext = t.includes("webm") ? "webm" : t.includes("mp4") || t.includes("aac") ? "m4a" : t.includes("ogg") ? "ogg" : "audio";
  return `gravacao-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}.${ext}`;
}

function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Apaga as cópias enviadas que o app guardou no cache (usado no "Apagar todas" do Gravador). Sem a ponte do Android, não há cópia: devolve true. */
export function apagarCopiasEnviadas(): boolean {
  try {
    return ponte()?.limparTudo?.() ?? true;
  } catch {
    return false;
  }
}

/** Depois de um envio com texto: a ponte do Android copiou o contexto? Fora dela (Web Share) ou numa ponte antiga, nada é copiado: falso. */
export function contextoFoiCopiado(): boolean {
  try {
    return ponte()?.getCopiouContexto?.() ?? false;
  } catch {
    return false;
  }
}

export function podeCompartilhar(): boolean {
  if (ponte()) return true;
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && typeof navigator.share === "function";
}

/**
 * Abre a folha de compartilhamento com o áudio. Devolve "ok" quando a folha abriu (ou o navegador compartilhou), "cancelado" se a pessoa fechou a folha do
 * navegador sem enviar e "erro" se não foi possível preparar o envio.
 */
export function compartilharGravacao(blob: Blob, nome: string, titulo: string, texto?: string): Promise<"ok" | "cancelado" | "erro"> {
  // Um envio de cada vez: a ponte tem um arquivo em andamento só, e dois envios juntos se misturariam.
  const vez = fila.then(() => enviarAgora(blob, nome, titulo, texto));
  fila = vez.then(() => undefined, () => undefined);
  return vez;
}

let fila: Promise<void> = Promise.resolve();

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

async function enviarAgora(blobOriginal: Blob, nomeOriginal: string, titulo: string, texto?: string): Promise<"ok" | "cancelado" | "erro"> {
  const conv = await prepararOgg(blobOriginal, nomeOriginal);
  const blob = conv?.blob ?? blobOriginal;
  const nome = conv?.nome ?? nomeOriginal;
  const tipo = tipoSemCodec(blob.type); // sem parâmetros: o Intent do Android compara o tipo por igualdade com o que os apps declaram
  try {
    const p = ponte();
    if (p) {
      if (!p.comecar(nome, tipo)) return "erro";
      try {
        for (let i = 0; i < blob.size; i += BYTES_POR_PEDACO) {
          const bytes = new Uint8Array(await blob.slice(i, i + BYTES_POR_PEDACO).arrayBuffer());
          if (!p.parte(paraBase64(bytes))) {
            p.cancelar();
            return "erro";
          }
        }
        return (texto && p.enviarComTexto ? p.enviarComTexto(titulo, texto) : p.enviar(titulo)) ? "ok" : "erro";
      } catch (e) {
        // Falhou no meio (ler o pedaço, codificar): a ponte fecha o arquivo e apaga o que já tinha escrito.
        try {
          p.cancelar();
        } catch {
          /* a ponte já falhou: nada mais a fazer */
        }
        throw e;
      }
    }
    let arquivo = new File([blob], nome, { type: tipo });
    // Se o navegador não aceita o Ogg convertido, tenta o original.
    if (!navigator.canShare?.({ files: [arquivo] }) && conv) arquivo = new File([blobOriginal], nomeOriginal, { type: tipoSemCodec(blobOriginal.type) });
    if (!navigator.canShare?.({ files: [arquivo] })) return "erro";
    await navigator.share({ files: [arquivo], title: titulo, ...(texto ? { text: texto } : {}) });
    return "ok";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    console.warn("compartilhar: falhou", e);
    return "erro";
  }
}
