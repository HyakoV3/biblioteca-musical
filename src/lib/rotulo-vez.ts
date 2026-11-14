import { i18n } from "./i18n/index.svelte";
import type { Chave } from "./i18n/pt";

/** Nome de uma vez para mostrar na tela: "Primeira vez", "Terceira vez · final". Vai de 1 a 8. */
export function rotuloDaVez(vez: number, final: boolean): string {
  const n = Math.min(8, Math.max(1, Math.floor(vez) || 1));
  const nome = i18n.t(`vez.${n}` as Chave);
  return final ? i18n.t("vez.rotulo_final", { vez: nome }) : nome;
}
