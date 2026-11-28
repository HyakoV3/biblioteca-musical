// O relógio e o medidor de som da gravação em curso: dois temporizadores que escrevem o estado que a tela mostra. Separado de `gravacaoEmCurso.svelte.ts`.
import { DetectorDeSom, nivelParaBarra, suavizarBarra } from "./gravador";

/** O que a medição escreve (os campos reativos da gravação em curso). */
export type AlvoDaMedicao = {
  decorrido: number;
  nivel: number;
  ouviu: boolean;
  semSom: boolean;
};
/** O que a medição lê do gravador. */
export type FonteDeNivel = { nivel: () => number; medidorAtivo: boolean };

export class Medicao {
  private relogio: ReturnType<typeof setInterval> | null = null;
  private medidor: ReturnType<typeof setInterval> | null = null;
  private readonly detector = new DetectorDeSom();

  constructor(
    private readonly alvo: AlvoDaMedicao,
    private readonly fonte: FonteDeNivel,
    private readonly agora: () => number,
  ) {}

  iniciar(): void {
    const agora = this.agora;
    const alvo = this.alvo;
    alvo.decorrido = 0;
    const comeco = agora();
    this.relogio = setInterval(() => (alvo.decorrido = (agora() - comeco) / 1000), 250);
    this.detector.reiniciar(agora());
    this.medidor = setInterval(() => this.medir(), 80);
  }

  private medir(): void {
    const alvo = this.alvo;
    const atual = this.fonte.nivel();
    alvo.nivel = suavizarBarra(alvo.nivel, nivelParaBarra(atual));
    const r = this.detector.atualizar(atual, this.agora());
    if (r.comSom) alvo.ouviu = true;
    // Sem medidor (sem AudioContext, ou o navegador o deixou suspenso), o nível é sempre 0: isso não prova que não há som, então não avisa.
    alvo.semSom = this.fonte.medidorAtivo && r.semSom;
  }

  /** Para os dois temporizadores e zera o que a tela mostra. */
  parar(): void {
    if (this.relogio !== null) clearInterval(this.relogio);
    this.relogio = null;
    if (this.medidor !== null) clearInterval(this.medidor);
    this.medidor = null;
    this.alvo.nivel = 0;
    this.alvo.ouviu = false;
    this.alvo.semSom = false;
  }
}
