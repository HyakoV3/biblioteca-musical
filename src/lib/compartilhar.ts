// Compartilhar uma gravação pela folha de compartilhamento do sistema (a que mostra os apps mais usados: WhatsApp etc.). No Android a WebView não abre
// essa folha sozinha, então o app tem uma ponte (`PonteCompartilhar.kt`, `window.BmCompartilhar`) que recebe o áudio em pedaços e abre a folha.
// Fora do Android usa a Web Share API quando o navegador compartilha arquivos; sem nenhuma das duas, `podeCompartilhar()` é falso e o botão nem aparece.

import { BYTES_POR_PEDACO, enviarAgora, ponte, tipoSemCodec, type Resultado } from "./compartilharEnvio";

// A API pública continua aqui: quem importa de "./compartilhar" não muda.
export { BYTES_POR_PEDACO, tipoSemCodec };

/** Nome do arquivo enviado: "gravacao-AAAA-MM-DD-HHMM.ext", com a extensão do formato. O áudio em WebM sai como ".ogg" (convertido em `prepararOgg`); o ".webm" só vale quando a conversão falha. */
export function nomeDoArquivo(criadaEm: number, tipo: string): string {
  const d = new Date(criadaEm);
  const dois = (n: number) => String(n).padStart(2, "0");
  const t = tipoSemCodec(tipo);
  const ext = t.includes("webm") ? "webm" : t.includes("mp4") || t.includes("aac") ? "m4a" : t.includes("ogg") ? "ogg" : "audio";
  return `gravacao-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}.${ext}`;
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
export function compartilharGravacao(blob: Blob, nome: string, titulo: string, texto?: string): Promise<Resultado> {
  // Um envio de cada vez: a ponte tem um arquivo em andamento só, e dois envios juntos se misturariam.
  const vez = fila.then(() => enviarAgora({ blob, nome, titulo, texto }));
  fila = vez.then(() => undefined, () => undefined);
  return vez;
}

let fila: Promise<void> = Promise.resolve();
