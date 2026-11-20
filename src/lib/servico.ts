// Ponte com o serviço de reprodução do Android (I-22): enquanto um hino toca, um serviço em primeiro plano (com notificação) segura o app vivo
// para o som não parar com a tela bloqueada ou o app em segundo plano. O lado Android é `ServicoAudio.kt` e a ponte `PonteServico.kt`, exposta à
// WebView como `window.BmccbServico`. Fora do Android (navegador, computador, testes) a ponte não existe e tudo aqui não faz nada.

type Ponte = { iniciar(titulo: string): void; parar(): void; iniciarGravacao?(): void; pararGravacao?(): void; temFone?(): boolean };

const ponte = (): Ponte | null => (globalThis as { BmccbServico?: Ponte }).BmccbServico ?? null;

let ligadoCom: string | null = null;

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
  (globalThis as { __bmccbParadoPelaNotificacao?: () => void }).__bmccbParadoPelaNotificacao = quando;
}

/**
 * O Gravador começou a gravar: liga o serviço com o tipo microfone, para a gravação seguir com a tela bloqueada ou o app em segundo plano.
 * Devolve `true` se o Android assumiu a gravação (aí o app NÃO deve parar de gravar ao sair da tela); fora do Android, ou se a ponte falhar,
 * devolve `false` e o app continua parando a gravação ao ir para segundo plano (o navegador tira o microfone da página escondida).
 */
export function ligarServicoDeGravacao(): boolean {
  try {
    const p = ponte();
    if (!p?.iniciarGravacao) return false;
    p.iniciarGravacao();
    return true;
  } catch (e) {
    console.warn("servico: a ponte do serviço de gravação falhou", e);
    return false;
  }
}

/** A gravação terminou (ou nunca começou): solta o serviço. Sem efeito fora do Android. */
export function desligarServicoDeGravacao(): void {
  try {
    ponte()?.pararGravacao?.();
  } catch (e) {
    console.warn("servico: a ponte do serviço de gravação falhou", e);
  }
}

/** O botão "Parar" da notificação, durante uma gravação: `quando` deve parar a gravação de verdade. */
export function aoPararGravacaoPelaNotificacao(quando: () => void): () => void {
  const g = globalThis as { __bmccbGravacaoParadaPelaNotificacao?: () => void };
  g.__bmccbGravacaoParadaPelaNotificacao = quando;
  return () => {
    if (g.__bmccbGravacaoParadaPelaNotificacao === quando) delete g.__bmccbGravacaoParadaPelaNotificacao;
  };
}

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
