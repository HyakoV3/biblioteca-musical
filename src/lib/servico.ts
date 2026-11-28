// Ponte com o serviço de reprodução do Android (I-22): enquanto um hino toca, um serviço em primeiro plano (com notificação) segura o app vivo
// para o som não parar com a tela bloqueada ou o app em segundo plano. O lado Android é `ServicoAudio.kt` e a ponte `PonteServico.kt`, exposta à
// WebView como `window.BmServico`. Fora do Android (navegador, computador, testes) a ponte não existe e tudo aqui não faz nada.

type Ponte = { iniciar(titulo: string): void; parar(): void; iniciarGravacao?(): void; pararGravacao?(): void; temFone?(): boolean; rotaDeSaida?(): string; manterTela?(ligar: boolean): void; iniciarMetronomo?(): void; pararMetronomo?(): void };

const ponte = (): Ponte | null => (globalThis as { BmServico?: Ponte }).BmServico ?? null;

let ligadoCom: string | null = null;

/** Registra em `globalThis[chave]` o aviso que o Android chama; devolve a função que o remove (só se ainda for o mesmo). */
function registrarAviso(chave: string, quando: () => void): () => void {
  const g = globalThis as unknown as Record<string, (() => void) | undefined>;
  g[chave] = quando;
  return () => {
    if (g[chave] === quando) delete g[chave];
  };
}

/** Pede à ponte que ligue um serviço pelo método `metodo`: `true` se o Android o assumiu; sem a ponte, com ponte antiga ou com falha, `false` (a falha vai para o console). */
function ligarPelaPonte(metodo: "iniciarGravacao" | "iniciarMetronomo", quem: string): boolean {
  try {
    const p = ponte();
    if (!p?.[metodo]) return false;
    p[metodo]();
    return true;
  } catch (e) {
    console.warn(`servico: a ponte do serviço ${quem} falhou`, e);
    return false;
  }
}

/** Pede à ponte que solte um serviço pelo método `metodo`; uma falha vai para o console e nunca propaga. */
function desligarPelaPonte(metodo: "pararGravacao" | "pararMetronomo", quem: string): void {
  try {
    ponte()?.[metodo]?.();
  } catch (e) {
    console.warn(`servico: a ponte do serviço ${quem} falhou`, e);
  }
}

/**
 * Liga o serviço quando o hino passa a tocar, atualiza o título da notificação se o hino mudou e o desliga ao pausar, parar ou terminar.
 * Chamar de novo com o mesmo estado não faz nada. Uma falha da ponte nunca derruba o som: vai para o console.
 */
export function sincronizarServico(tocando: boolean, titulo: string): void {
  try {
    if (tocando && ligadoCom !== titulo) {
      ponte()?.iniciar(titulo);
      ligadoCom = titulo;
    } else if (!tocando && ligadoCom !== null) {
      ponte()?.parar();
      ligadoCom = null;
    }
  } catch (e) {
    console.warn("servico: a ponte do serviço de reprodução falhou", e);
  }
}

/** O botão "Parar" da notificação chama isto (o Android avisa o JavaScript): `quando` deve parar o hino de verdade. */
export function aoPararPelaNotificacao(quando: () => void): void {
  (globalThis as { __bmParadoPelaNotificacao?: () => void }).__bmParadoPelaNotificacao = quando;
}

/**
 * O Gravador começou a gravar: liga o serviço com o tipo microfone, para a gravação seguir com a tela bloqueada ou o app em segundo plano.
 * Devolve `true` se o Android assumiu a gravação (aí o app NÃO deve parar de gravar ao sair da tela); fora do Android, ou se a ponte falhar,
 * devolve `false` e o app continua parando a gravação ao ir para segundo plano (o navegador tira o microfone da página escondida).
 */
export const ligarServicoDeGravacao = (): boolean => ligarPelaPonte("iniciarGravacao", "de gravação");

/** A gravação terminou (ou nunca começou): solta o serviço. Sem efeito fora do Android. */
export const desligarServicoDeGravacao = (): void => desligarPelaPonte("pararGravacao", "de gravação");

/** O botão "Parar" da notificação, durante uma gravação: `quando` deve parar a gravação de verdade. */
export const aoPararGravacaoPelaNotificacao = (quando: () => void): (() => void) => registrarAviso("__bmGravacaoParadaPelaNotificacao", quando);

/**
 * Há um fone de ouvido (com fio, USB ou Bluetooth) ligado? Com ele o hino pode tocar enquanto o Gravador grava, porque o som não volta ao microfone.
 * Fora do Android, ou se a ponte falhar, devolve `false` (o app trata como sem fone: um som de cada vez).
 */
export function foneConectado(): boolean {
  try {
    return ponte()?.temFone?.() === true;
  } catch (e) {
    console.warn("servico: não deu para saber se há fone", e);
    return false;
  }
}

/**
 * O Android recusou ou derrubou o serviço de gravação depois de a ponte já ter dito que o assumira: `quando` deve tirar a proteção da gravação
 * (e, se o app está em segundo plano, pará-la, porque o microfone se foi). Devolve a função que remove o aviso.
 */
export const aoFalharServicoDeGravacao = (quando: () => void): (() => void) => registrarAviso("__bmServicoDeGravacaoFalhou", quando);

/**
 * O metrônomo ligou: liga o serviço em primeiro plano (tipo mídia, wake lock sem limite) para o clique seguir com a tela bloqueada. Devolve `true` se o Android o assumiu;
 * fora do Android, ou com uma ponte antiga, devolve `false` (o clique segue só enquanto a página tiver os temporizadores).
 */
export const ligarServicoDoMetronomo = (): boolean => ligarPelaPonte("iniciarMetronomo", "do metrônomo");

/** O metrônomo parou: solta o serviço (ele só se encerra se hino e gravação também estão parados). */
export const desligarServicoDoMetronomo = (): void => desligarPelaPonte("pararMetronomo", "do metrônomo");

/** O botão "Parar" da notificação com o metrônomo ligado: `quando` deve parar o clique de verdade. Devolve a função que remove o aviso. */
export const aoPararMetronomoPelaNotificacao = (quando: () => void): (() => void) => registrarAviso("__bmMetronomoParadoPelaNotificacao", quando);

/** O Android recusou ou derrubou o serviço do metrônomo: `quando` deve parar o clique e avisar na tela. Devolve a função que remove o aviso. */
export const aoFalharServicoDoMetronomo = (quando: () => void): (() => void) => registrarAviso("__bmServicoDoMetronomoFalhou", quando);

/**
 * De onde o som sai agora: "usb", "fio" (3,5 mm), "bluetooth" ou "alto-falante". Fora do Android, sem a ponte (um APK antigo) ou se ela falhar,
 * devolve `null` (quem chama trata como alto-falante).
 */
export function rotaDeSaida(): string | null {
  try {
    return ponte()?.rotaDeSaida?.() ?? null;
  } catch (e) {
    console.warn("servico: não deu para saber a rota de saída", e);
    return null;
  }
}

/**
 * Pede ao Android para não apagar a tela (`FLAG_KEEP_SCREEN_ON` da janela) enquanto `ligar` for verdadeiro; falso devolve a tela ao tempo do sistema.
 * Fora do Android, ou com uma ponte antiga, não faz nada.
 */
export function manterTelaLigada(ligar: boolean): void {
  try {
    ponte()?.manterTela?.(ligar);
  } catch (e) {
    console.warn("servico: a ponte da tela ligada falhou", e);
  }
}
