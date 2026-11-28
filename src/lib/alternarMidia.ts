// Liga o botão "Tocar ou Pausar" da notificação (I-47, etapa 1) ao hino e ao metrônomo. O JavaScript decide o que alternar, porque o estado vive aqui;
// o resultado volta ao Android pelos efeitos que já sincronizam o serviço, então a notificação e o app aberto têm uma só fonte da verdade.
import { alvoDoAlternar } from "./alvoDoAlternar";
import { metronomo } from "./metronomo.svelte";
import { reproducao } from "./reproducao.svelte";

/** Alterna o que estiver à mão: pausa o metrônomo, alterna o hino ou volta a tocar o metrônomo pausado. */
export function alternarPelaNotificacao(): void {
  const alvo = alvoDoAlternar(reproducao.estado, metronomo.ligado, metronomo.pausado);
  if (alvo === "metronomo") metronomo.parar(true);
  else if (alvo === "hino") void reproducao.alternarAtual();
  else if (alvo === "metronomo-pausado") void metronomo.iniciar();
}
