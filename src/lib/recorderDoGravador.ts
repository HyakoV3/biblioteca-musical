// O `MediaRecorder` do gravador: criação no formato preferido e parada com limite de espera (reexportado por `gravador.ts`).

import { escolherFormato } from "./gravadorTexto";

/** 64 kbps: bom para voz e instrumento e compacto (o padrão do navegador gravava a cerca de 135 kbps, o dobro, sem ganho que se ouça). */
export const BITS_POR_SEGUNDO = 64000;

/** Um rastro leve do que o gravador faz (console.debug): quando algo trava só no CI, é isto que mostra em que passo. */
export const rastro = (mensagem: string) => console.debug(`gravador: ${mensagem}`);

/** Quanto se espera o aviso de que o MediaRecorder parou antes de entregar o que já foi gravado (ms). */
export const LIMITE_PARA_PARAR_MS = 4000;

/** O `MediaRecorder` sobre `entrada`, no formato preferido que o navegador grava (ou no que ele escolher). */
export function criarRecorder(entrada: MediaStream): { recorder: MediaRecorder; preferido: string | null } {
  const preferido = escolherFormato((t) => MediaRecorder.isTypeSupported(t));
  const recorder = preferido
    ? new MediaRecorder(entrada, { mimeType: preferido, audioBitsPerSecond: BITS_POR_SEGUNDO })
    : new MediaRecorder(entrada, { audioBitsPerSecond: BITS_POR_SEGUNDO });
  return { recorder, preferido };
}

/**
 * Para o gravador `g` e chama `entregarArquivo` uma vez só: quando ele avisa que parou, quando o `stop()` falha, ou passado o limite. Se o "stop" nunca
 * chega (visto no CI: a gravação para, o microfone volta e nada entra na lista, sem erro na tela), a espera não pode ser eterna: passado o limite,
 * entrega o que já foi gravado (os pedaços de cada segundo), ou nulo, e a tela mostra o erro. `antesDeParar` roda logo antes do `stop()`.
 */
export function pararEEntregar(g: MediaRecorder, antesDeParar: () => void, entregarArquivo: () => void): void {
  let entregue = false;
  const entregar = (motivo: "avisou" | "limite" | "erro", erro?: unknown) => {
    if (entregue) return;
    entregue = true;
    clearTimeout(limite);
    if (motivo === "limite") console.warn("gravador: o MediaRecorder não avisou que parou; entregando o que já estava gravado");
    else if (motivo === "erro") console.warn("gravador: MediaRecorder.stop() falhou; entregando o que já estava gravado", erro);
    else rastro("o gravador avisou que parou");
    // Solta os ouvintes do gravador antigo: um pedaço ou um erro que chegasse tarde, já com outra gravação na mesma instância, não pode entrar nela.
    g.ondataavailable = null;
    g.onerror = null;
    g.onstop = null;
    entregarArquivo();
  };
  const limite = setTimeout(() => entregar("limite"), LIMITE_PARA_PARAR_MS);
  g.onstop = () => entregar("avisou");
  antesDeParar();
  try {
    g.stop();
  } catch (e) {
    entregar("erro", e);
  }
}

/** Para o gravador sem esperar nem avisar (esquece o aviso de parada): usado ao soltar tudo. Se já estava parado, não faz nada. */
export function pararSemAvisar(g: MediaRecorder): void {
  if (g.state === "inactive") return;
  g.onstop = null;
  try {
    g.stop();
  } catch {
    /* já parado */
  }
}

/**
 * Liga os avisos do gravador e do microfone: `receber` a cada pedaço, `interrompida` quando o gravador dá erro, o SISTEMA tira o microfone, ou (com filtro,
 * passando o contexto em `ctxComFiltro`) o contexto de áudio para: a gravação sairia muda sem o microfone cair.
 */
export function ligarOuvintes(recorder: MediaRecorder, mic: MediaStream, ctxComFiltro: AudioContext | null, receber: (dado: Blob) => void, interrompida: () => void): void {
  recorder.ondataavailable = (e) => receber(e.data);
  recorder.onerror = interrompida;
  // `stop()` da trilha (o nosso) não dispara "ended"; este evento só chega quando o SISTEMA tira o microfone.
  mic.getTracks().forEach((t) => t.addEventListener("ended", interrompida));
  const ctx = ctxComFiltro;
  if (ctx) ctx.onstatechange = () => ctx.state !== "running" && interrompida();
}

/** Guarda o pedaço que chegou (se não vazio) e avisa `aoPedaco` com o número dele; uma falha de quem avisa não atrapalha a gravação. */
export function guardarPedaco(pedacos: Blob[], dado: Blob, aoPedaco: ((indice: number, pedaco: Blob) => void) | null): void {
  if (dado.size === 0) return;
  const indice = pedacos.length;
  pedacos.push(dado);
  try {
    aoPedaco?.(indice, dado);
  } catch (erro) {
    console.warn("gravador: quem guarda os pedaços falhou", erro); // a gravação em memória segue igual
  }
}
