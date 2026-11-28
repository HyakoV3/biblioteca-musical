<script lang="ts" generics="T">
  import { quantosCabem } from "./cabem";

  // A lista "usados recentemente" do metrônomo e do afinador. Mostra só quantos itens CABEM na tela, do começo da lista até o fim dela (sempre inteiros, e pode sobrar um
  // pouco de espaço); o resto fica guardado e volta a aparecer se a tela crescer (girar o aparelho, fonte menor). Recalcula ao girar, ao mudar o tamanho da letra, ao
  // abrir a aba e quando algo acima da lista muda de altura.
  let {
    titulo,
    itens,
    rotulo,
    atual,
    aoEscolher,
    ativa = true,
  }: {
    titulo: string;
    itens: readonly T[];
    /** O texto do botão de um item. */
    rotulo: (item: T) => string;
    /** O item que já está em uso (destacado). */
    atual: (item: T) => boolean;
    aoEscolher: (item: T) => void;
    /** A aba da lista está à vista? Escondida, não há o que medir. */
    ativa?: boolean;
  } = $props();

  const MARGEM_BAIXO = 16; // px que ficam livres embaixo da última linha
  let secao = $state<HTMLElement | null>(null);
  let quantos = $state(10);
  const visiveis = $derived(itens.slice(0, Math.max(quantos, Math.min(1, itens.length))));

  function medir() {
    const ul = secao?.querySelector("ul");
    const li = ul?.querySelector("li");
    if (!secao || !ul || !li || !secao.offsetParent) return; // sem lista, ou aba escondida: nada a medir
    const topo = ul.getBoundingClientRect().top + window.scrollY;
    const vao = parseFloat(getComputedStyle(ul).rowGap) || 0;
    // A barra de abas e o miniplayer são fixos e cobrem o rodapé: o que fica atrás deles não conta como espaço.
    const css = getComputedStyle(document.documentElement);
    const reservado = (parseFloat(css.getPropertyValue("--altura-miniplayer")) || 0) + (parseFloat(css.getPropertyValue("--altura-navegacao")) || 0);
    const novo = quantosCabem(window.innerHeight - reservado - topo - MARGEM_BAIXO, li.getBoundingClientRect().height, vao, itens.length);
    if (novo !== quantos) quantos = novo;
  }

  $effect(() => {
    void ativa;
    void itens.length;
    const quadro = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(quadro);
  });
  $effect(() => {
    // `resize` vale sempre (girar o aparelho); o ResizeObserver só existe em WebViews recentes. As barras fixas avisam da própria altura pelo `style` da raiz (variáveis CSS).
    window.addEventListener("resize", medir);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => medir()) : null;
    ro?.observe(document.documentElement);
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => medir()) : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", medir);
    };
  });
</script>

{#if itens.length > 0}
  <section class="recentes" bind:this={secao} aria-label={titulo}>
    <h2>{titulo}</h2>
    <ul>
      {#each visiveis as item (rotulo(item))}
        <li>
          <button class="botao" aria-current={atual(item)} onclick={() => aoEscolher(item)}>{rotulo(item)}</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .recentes h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--espaco); }
  button { width: 100%; min-height: var(--toque); justify-content: flex-start; }
  button[aria-current="true"] { font-weight: 700; border-color: var(--ouro-linha); }
</style>
