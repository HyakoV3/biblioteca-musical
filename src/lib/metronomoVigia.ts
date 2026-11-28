// O vigia do metrônomo (I-20): o temporizador grosso que acorda para olhar adiante e o aviso de que a página foi escondida ou reaparecida.
import { INTERVALO_MS } from "./metronomoAgenda";

export class Vigia {
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly olhar: () => void) {}

  /** Liga o temporizador e, ao esconder a página (o navegador freia os temporizadores), agenda já a janela grande, antes do próximo (atrasado) tick. */
  ligar(): void {
    this.temporizador = setInterval(() => this.olhar(), INTERVALO_MS);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.aoVisibilidade);
  }

  desligar(): void {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.aoVisibilidade);
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private readonly aoVisibilidade = () => this.olhar();
}
