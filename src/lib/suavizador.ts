// A suavização do que o "Qual nota é essa?" MOSTRA (I-41): a posição da bola e o número de cents. PURO, com o relógio injetado (o mesmo `agora` da leitura). O detector e a escolha da nota não
// mudam: o `Estabilizador` já diz qual nota é; aqui se acalma ONDE a bola fica e QUAL número aparece.
//
// Média exponencial (EMA) simétrica com o tempo real entre leituras: `alfa = 1 − exp(−ms/τ)`. Simétrica, porque os cents têm sinal e a bola deve reagir igual dos dois lados (a `suavizarBarra` do
// gravador sobe rápido e cai devagar: serve a um nível de volume, e não a cents).
import type { Estado } from "./detector";

/** Constante de tempo da EMA (ms). Ponto de partida: só o aparelho do responsável diz o certo (ver docs/ideia-suavizar-afinador.md). */
export const TAU_MS = 150;
/** O número mostrado só troca quando o valor suave se afasta dele por pelo menos isto (cents): mantém a resolução de 1 cent sem piscar. */
export const ZONA_MORTA_CENTS = 1.5;

export type Suave = {
  /** Cents suavizados (a posição da bola, contínua). */
  suave: number;
  /** O número que aparece (inteiro), com zona morta. É o mesmo para a tela, para a palavra e para o leitor de tela. */
  mostrado: number;
};

export class SuavizadorDeCents {
  private suave: number | null = null;
  private mostrado = 0;
  private midi: number | null = null;
  private t = 0;
  /** A leitura anterior era a nota congelada (o som parou): a próxima nota nova salta em vez de deslizar. */
  private congelou = false;

  constructor(
    private readonly tau: number = TAU_MS,
    private readonly zona: number = ZONA_MORTA_CENTS,
  ) {}

  reiniciar(): void {
    this.suave = null;
    this.midi = null;
    this.congelou = false;
  }

  /** Devolve os cents calmos do instante, ou nulo em silêncio. Chamar logo depois de `estabilizador.entrar(agora, …)`, com o MESMO `agora`. */
  entrar(agora: number, e: Estado): Suave | null {
    if (e.tipo === "silencio") {
      this.reiniciar();
      return null;
    }
    const atual = e.leitura.cents;
    if (!Number.isFinite(atual)) return this.suave === null ? null : { suave: this.suave, mostrado: this.mostrado };

    // Nota congelada (o som acabou) e quadro suspeito de erro de oitava: a leitura é a MESMA de antes. Segura o valor, sem andar (senão a bola deslizaria esmaecida até o valor bruto antigo).
    if (e.repetida && this.suave !== null) {
      if (e.tipo === "congelada") this.congelou = true;
      this.t = agora;
      return { suave: this.suave, mostrado: this.mostrado };
    }

    // Salta (sem deslizar): o primeiro valor, a troca da nota que SOA (a trilha se recentra e a leitura passa de, por exemplo, +55 para −45) e a volta depois do silêncio.
    if (this.suave === null || e.leitura.midi !== this.midi || this.congelou) {
      this.suave = atual;
      this.mostrado = Math.round(atual);
    } else {
      const ms = agora - this.t;
      // `ms` inválido (≤ 0, NaN): segura o valor; `ms` enorme: alfa vai a 1 e o valor salta.
      const alfa = ms > 0 && Number.isFinite(ms) ? 1 - Math.exp(-ms / this.tau) : 0;
      this.suave += alfa * (atual - this.suave);
      if (Math.abs(this.suave - this.mostrado) >= this.zona) this.mostrado = Math.round(this.suave);
    }
    this.midi = e.leitura.midi;
    this.t = agora;
    this.congelou = false;
    return { suave: this.suave, mostrado: this.mostrado };
  }
}
