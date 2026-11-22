// A saída de áudio: de onde o som sai (alto-falante, fone com fio, USB ou Bluetooth) e como o app cria o AudioContext para ela.
//
// Todo celular tem um conversor de áudio; sem a entrada de fone de 3,5 mm, o som sai DIGITAL pela USB-C e o conversor fica no cabo. Cada rota tem o
// seu buffer, e o que estala numa não estala na outra (um buffer maior estalou MAIS no fone USB do autor, então não há regra segura): por isso a escolha
// é da pessoa, GUARDADA POR ROTA, e as medidas do contexto aparecem em Ajustes para comparar com números.
//
// Modos: "automatico" (o padrão do navegador, igual ao que o app sempre fez), "estavel" (`latencyHint: "playback"`, buffer maior) e "atraso"
// (`latencyHint: "interactive"`, buffer pequeno). O navegador pode tratar o `latencyHint` como um simples pedido; as medidas mostram o que valeu.
import { rotaDeSaida as rotaDoAndroid } from "./servico";

export type Rota = "alto-falante" | "fio" | "usb" | "bluetooth";
export type Modo = "automatico" | "estavel" | "atraso";
export const ROTAS: readonly Rota[] = ["alto-falante", "fio", "usb", "bluetooth"];
export const MODOS: readonly Modo[] = ["automatico", "estavel", "atraso"];
export const MODO_PADRAO: Modo = "automatico";
export const CHAVE_SAIDA_AUDIO = "prefs.saida-audio";

export const rotaValida = (v: unknown): v is Rota => typeof v === "string" && (ROTAS as readonly string[]).includes(v);
export const modoValido = (v: unknown): v is Modo => typeof v === "string" && (MODOS as readonly string[]).includes(v);

/** As escolhas de cada rota (só as que a pessoa mudou do padrão), SEMPRE validadas ao ler. */
export function lerModos(): Partial<Record<Rota, Modo>> {
  try {
    const bruto = localStorage.getItem(CHAVE_SAIDA_AUDIO);
    const o = bruto ? (JSON.parse(bruto) as unknown) : null;
    if (!o || typeof o !== "object") return {};
    const saida: Partial<Record<Rota, Modo>> = {};
    for (const r of ROTAS) {
      const v = (o as Record<string, unknown>)[r];
      if (modoValido(v)) saida[r] = v;
    }
    return saida;
  } catch {
    return {};
  }
}

export const lerModo = (rota: Rota): Modo => lerModos()[rota] ?? MODO_PADRAO;

export function salvarModo(rota: Rota, modo: Modo): void {
  try {
    const todos = lerModos();
    if (modo === MODO_PADRAO) delete todos[rota];
    else todos[rota] = modo;
    localStorage.setItem(CHAVE_SAIDA_AUDIO, JSON.stringify(todos));
  } catch {
    // sem armazenamento: vale a escolha da próxima vez que o app abrir, que volta ao padrão
  }
}

/** O que o modo pede ao `AudioContext`. O automático não pede nada: é o comportamento de sempre. */
export function opcoesDoModo(modo: Modo): AudioContextOptions {
  return modo === "estavel" ? { latencyHint: "playback" } : modo === "atraso" ? { latencyHint: "interactive" } : {};
}

/** A rota de saída agora. Fora do Android (ou sem a ponte), o alto-falante. */
export function rotaAtual(): Rota {
  const r = rotaDoAndroid();
  return rotaValida(r) ? r : "alto-falante";
}

/** O que o último contexto criado mediu. `saida` é `null` nos aparelhos que não informam `outputLatency`. */
export type Medida = { rota: Rota; modo: Modo; taxa: number; base: number | null; saida: number | null };
let ultima: Medida | null = null;
const ouvintes = new Set<() => void>();
export const ultimaMedida = (): Medida | null => ultima;
/** Avisa quando um contexto novo é criado (Ajustes mostra as medidas). Devolve o cancelamento. */
export function aoMedir(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const ms = (s: unknown): number | null => (typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : null);

/** A chave do que vale agora (rota e modo): quem guarda um contexto o refaz quando ela muda. */
export const chaveAtual = (): string => {
  const r = rotaAtual();
  return `${r}:${lerModo(r)}`;
};

/**
 * Cria o AudioContext para a rota e o modo de agora e guarda as medidas dele. Um navegador que recuse a opção (um valor que não conhece) cai no
 * contexto padrão: o som nunca deixa de tocar por causa disto.
 */
export function criarContexto(): AudioContext {
  const rota = rotaAtual();
  const modo = lerModo(rota);
  let ctx: AudioContext;
  try {
    ctx = new AudioContext(opcoesDoModo(modo));
  } catch (e) {
    console.warn("saidaAudio: o navegador recusou as opções do áudio, usando o padrão", e);
    ctx = new AudioContext();
  }
  ultima = { rota, modo, taxa: ctx.sampleRate, base: ms(ctx.baseLatency), saida: ms(ctx.outputLatency) };
  for (const fn of ouvintes) fn();
  return ctx;
}
