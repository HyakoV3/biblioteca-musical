// Ponte com o serviço de reprodução do Android (I-22): enquanto um hino toca, um serviço em primeiro plano (com notificação) segura o app vivo
// para o som não parar com a tela bloqueada ou o app em segundo plano. O lado Android é `ServicoAudio.kt` e a ponte `PonteServico.kt`, exposta à
// WebView como `window.BmccbServico`. Fora do Android (navegador, computador, testes) a ponte não existe e tudo aqui não faz nada.

type Ponte = { iniciar(titulo: string): void; parar(): void };

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
