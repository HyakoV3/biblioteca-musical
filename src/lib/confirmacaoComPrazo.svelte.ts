// Um botão perigoso que pede um segundo toque: o primeiro arma a confirmação, que expira sozinha depois de `ms`; o segundo, dentro do prazo, a consome.
export class ConfirmacaoComPrazo {
  /** A confirmação está armada (o botão mostra o aviso). */
  pedida = $state(false);
  #relogio: ReturnType<typeof setTimeout> | null = null;
  readonly #ms: number;

  constructor(ms: number) {
    this.#ms = ms;
  }

  /** Arma a confirmação; ela se desarma sozinha depois do prazo. */
  pedir(): void {
    this.pedida = true;
    this.#relogio = setTimeout(() => (this.pedida = false), this.#ms);
  }

  /** Desarma sem esperar o prazo (o segundo toque, ou a tela saindo). */
  cancelar(): void {
    if (this.#relogio !== null) clearTimeout(this.#relogio);
    this.#relogio = null;
    this.pedida = false;
  }
}
