import { i18n } from "./i18n/index.svelte";
import type { Chave } from "./i18n/pt";

const limitar = (vez: number) => Math.min(8, Math.max(1, Math.floor(vez) || 1));

/** Nome de uma vez para mostrar na tela: "Primeira vez", "Terceira vez · final". Vai de 1 a 8. */
export function rotuloDaVez(vez: number, final: boolean): string {
  const nome = i18n.t(`vez.${limitar(vez)}` as Chave);
  return final ? i18n.t("vez.rotulo_final", { vez: nome }) : nome;
}

/** Nome curto para o botão compacto: "1ª", "2ª"... (o nome completo vai no rótulo de acessibilidade). */
export function rotuloCurtoDaVez(vez: number): string {
  return i18n.t(`vez.curta.${limitar(vez)}` as Chave);
}

/** Nome da parte que toca: a introdução ou uma vez. */
export function rotuloDaParte(parte: "intro" | number, final: boolean): string {
  return parte === "intro" ? i18n.t("vez.intro") : rotuloDaVez(parte, final);
}
