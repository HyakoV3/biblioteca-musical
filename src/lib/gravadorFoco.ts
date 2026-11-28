// Para onde vai o foco do teclado e do leitor de tela quando a lista de gravações muda por baixo dele (apagar, tirar a estrela). Mexe no DOM; a escolha do item vizinho é pura (`vizinhoNaOrdem`).
import { tick } from "svelte";

const itemDe = (id: string) => `[data-id="${CSS.escape(id)}"]`;

/** Leva o foco ao botão principal do item (se o id existir). */
export const focarItem = (id: string | undefined) => (id ? (document.querySelector(`${itemDe(id)} button`) as HTMLElement | null) : null)?.focus();

/** O título da lista: o último lugar do foco quando não resta item nenhum. */
const focarTitulo = () => document.getElementById("titulo-guardadas")?.focus();

/** O item seguinte da tela (ou o anterior), para onde o foco vai quando `id` sai do lugar. */
export const vizinhoNaOrdem = (ordem: readonly string[], id: string): string | undefined => {
  const i = ordem.indexOf(id);
  return ordem[i + 1] ?? ordem[i - 1];
};

/** O foco está dentro do item `id`? */
export const itemTemOFoco = (id: string): boolean => document.activeElement?.closest("[data-id]")?.getAttribute("data-id") === id;

/** O item vizinho, se ainda está na tela; sem ele, o título da lista. */
export function focarVizinhoOuTitulo(vizinho: string | undefined): void {
  if (vizinho && document.querySelector(itemDe(vizinho))) focarItem(vizinho);
  else focarTitulo();
}

/** Depois de uma mudança que podia tirar o foco do item (o nó foi movido ou removido): devolve-o ao próprio item, ao vizinho ou ao título. Só age se o item TINHA o foco e ele se perdeu. */
export async function recuperarFoco(id: string, vizinho: string | undefined, tinhaFoco: boolean): Promise<void> {
  await tick();
  if (!tinhaFoco) return;
  const ativo = document.activeElement;
  if (ativo && ativo !== document.body) return; // o foco está em algum lugar: não mexe
  const doItem = document.querySelector(`${itemDe(id)} .estrela`) as HTMLElement | null;
  if (doItem) doItem.focus();
  else focarVizinhoOuTitulo(vizinho);
}
