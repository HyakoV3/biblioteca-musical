// Compartilhar uma gravação pela folha de compartilhamento do sistema (a que mostra os apps mais usados: WhatsApp etc.). No Android a WebView não abre
// essa folha sozinha, então o app tem uma ponte (`PonteCompartilhar.kt`, `window.BmccbCompartilhar`) que recebe o áudio em pedaços e abre a folha.
// Fora do Android usa a Web Share API quando o navegador compartilha arquivos; sem nenhuma das duas, `podeCompartilhar()` é falso e o botão nem aparece.

type Ponte = {
  comecar(nome: string, tipo: string): boolean;
  parte(base64: string): boolean;
  enviar(titulo: string): boolean;
  cancelar(): void;
};

/** Múltiplo de 3 bytes (o base64 de cada pedaço não leva preenchimento no meio); 192 KiB por chamada à ponte. */
export const BYTES_POR_PEDACO = 3 * 65536;

const ponte = (): Ponte | null => (globalThis as { BmccbCompartilhar?: Ponte }).BmccbCompartilhar ?? null;

/** "audio/webm;codecs=opus" → "audio/webm". */
export function tipoSemCodec(tipo: string): string {
  return tipo.split(";")[0]!.trim().toLowerCase() || "audio/*";
}

/** Nome do arquivo enviado: "gravacao-AAAA-MM-DD-HHMM.ext", com a extensão do formato. */
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

export function podeCompartilhar(): boolean {
  if (ponte()) return true;
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && typeof navigator.share === "function";
}

/**
 * Abre a folha de compartilhamento com o áudio. Devolve "ok" quando a folha abriu (ou o navegador compartilhou), "cancelado" se a pessoa fechou a folha do
 * navegador sem enviar e "erro" se não foi possível preparar o envio.
 */
export function compartilharGravacao(blob: Blob, nome: string, titulo: string): Promise<"ok" | "cancelado" | "erro"> {
  // Um envio de cada vez: a ponte tem um arquivo em andamento só, e dois envios juntos se misturariam.
  const vez = fila.then(() => enviarAgora(blob, nome, titulo));
  fila = vez.then(() => undefined, () => undefined);
  return vez;
}

let fila: Promise<void> = Promise.resolve();

async function enviarAgora(blob: Blob, nome: string, titulo: string): Promise<"ok" | "cancelado" | "erro"> {
  const tipo = tipoSemCodec(blob.type);
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
        return p.enviar(titulo) ? "ok" : "erro";
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
    const arquivo = new File([blob], nome, { type: tipo });
    if (!navigator.canShare?.({ files: [arquivo] })) return "erro";
    await navigator.share({ files: [arquivo], title: titulo });
    return "ok";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    console.warn("compartilhar: falhou", e);
    return "erro";
  }
}
