// A contagem regressiva do temporizador do afinador (I-13): depois do tempo escolhido, o tom para sozinho. Código puro (sem tela e sem som),
// para se testar com relógio simulado. Quem usa recebe os segundos que faltam a cada instante (`aoMudar`) e é avisado quando chega a zero
// (`aoTerminar`); `null` em `aoMudar` quer dizer "sem contagem".

/** As opções de tempo: 0 é "até parar" (o comportamento de sempre: o tom soa até a pessoa parar). */
export const LIMITES = [0, 10, 20, 30] as const;
export type Limite = (typeof LIMITES)[number];

/** De quanto em quanto tempo a contagem confere o relógio (ms): o suficiente para o número na tela nunca atrasar mais que um quarto de segundo. */
const PASSO_MS = 250;

/** Segundos inteiros que faltam até `fimMs`, arredondando para CIMA (a tela mostra "1" até zerar, e nunca "0" com o tom ainda soando). Nunca negativo. */
export const segundosRestantes = (fimMs: number, agoraMs: number): number => Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));

/** Quanto da contagem já passou, de 0 a 1 (para a barra de progresso). Sem contagem (`restante` nulo) ou sem limite, é 0. */
export function fracaoFeita(limite: number, restante: number | null): number {
  if (restante === null || !Number.isFinite(limite) || limite <= 0) return 0;
  return Math.min(1, Math.max(0, (limite - restante) / limite));
}

export class Contagem {
  private relogio: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly aoMudar: (restante: number | null) => void,
    private readonly aoTerminar: () => void,
  ) {}

  /** Há uma contagem em andamento? */
  get ativa(): boolean {
    return this.relogio !== null;
  }

  /** Começa a contar `segundos` a partir de AGORA (cancela a contagem anterior). Com zero ou menos não conta nada: é o "até parar". */
  iniciar(segundos: number): void {
    this.pararRelogio(); // em silêncio: entre uma contagem e a seguinte não há um "sem contagem" no meio
    if (!Number.isFinite(segundos) || segundos <= 0) {
      this.aoMudar(null);
      return;
    }
    const fim = Date.now() + segundos * 1000;
    this.aoMudar(Math.ceil(segundos));
    this.relogio = setInterval(() => {
      const restante = segundosRestantes(fim, Date.now());
      if (restante <= 0) {
        this.cancelar();
        this.aoTerminar();
      } else {
        this.aoMudar(restante);
      }
    }, PASSO_MS);
  }

  /** Para de contar e avisa que não há mais contagem. Pode ser chamada sem contagem em andamento. */
  cancelar(): void {
    this.pararRelogio();
    this.aoMudar(null);
  }

  private pararRelogio(): void {
    if (this.relogio !== null) {
      clearInterval(this.relogio);
      this.relogio = null;
    }
  }
}
