// Qual dos dois o botão "Tocar ou Pausar" da notificação do Android (e o do fone) mexe (I-47, etapa 1). Pura, sem o estado do app, para testar.
import type { Estado } from "./reproducaoPlano";

export type AlvoDoAlternar = "metronomo" | "hino" | "metronomo-pausado" | null;

/**
 * O metrônomo tocando vence (é o que se ouve; um hino tocando já o teria calado); depois o hino (tocando ou pausado); por fim o metrônomo
 * pausado, que volta a tocar. Sem nenhum dos três, não há o que alternar.
 */
export function alvoDoAlternar(hino: Estado, metronomoLigado: boolean, metronomoPausado: boolean): AlvoDoAlternar {
  if (metronomoLigado) return "metronomo";
  if (hino === "tocando" || hino === "pausado") return "hino";
  return metronomoPausado ? "metronomo-pausado" : null;
}
