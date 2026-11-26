<script lang="ts">
  import Icone from "./Icone.svelte";
  import type { IconeNome } from "./icones";

  // O controle de passo (−5 − valor + +5): duas pílulas, uma de cada lado, com o valor solto no meio. O da esquerda diminui (do passo maior para o menor) e o da direita aumenta
  // (do menor para o maior), então o passo de 1 fica sempre ao lado do valor. Cada segmento é um botão de ação (não uma escolha): o desenho é o da pílula do `Segmentado`.
  type Botao = { texto?: string; icone?: IconeNome; aria: string; desabilitado?: boolean; aoClicar: () => void };
  let {
    rotulo,
    esquerda,
    direita,
    valor,
    dica,
    aoRestaurar,
  }: {
    /** O nome do grupo para o leitor de tela. */
    rotulo: string;
    esquerda: Botao[];
    direita: Botao[];
    valor: string;
    /** Dois cliques no valor o restauram (só onde `aoRestaurar` existe). */
    dica?: string;
    aoRestaurar?: () => void;
  } = $props();
</script>

{#snippet pilula(botoes: Botao[])}
  <div class="pilula">
    {#each botoes as b, i (i)}
      <button type="button" aria-label={b.aria} disabled={b.desabilitado} onclick={b.aoClicar}>{#if b.icone}<Icone nome={b.icone} tamanho={24} />{:else}{b.texto}{/if}</button>
    {/each}
  </div>
{/snippet}

<div class="passo" role="group" aria-label={rotulo}>
  {@render pilula(esquerda)}
  <output aria-live="polite" class:restauravel={!!aoRestaurar} title={aoRestaurar ? dica : undefined} ondblclick={aoRestaurar}>{valor}</output>
  {@render pilula(direita)}
</div>

<style>
  .passo { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; width: 100%; }
  .pilula { display: flex; flex: none; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; overflow: hidden; background: var(--superficie); }
  button { display: inline-flex; align-items: center; justify-content: center; min-width: 3rem; height: 3rem; padding: 0 0.5rem; font-size: 1.05rem; font-weight: 600; line-height: 1; cursor: pointer; border: 0; background: transparent; color: var(--texto); font-variant-numeric: tabular-nums; }
  button + button { border-left: 0.0625rem solid var(--borda-controle); }
  button:active:not(:disabled) { background: color-mix(in srgb, var(--acento) 14%, var(--superficie)); }
  button:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: -0.1875rem; }
  button:disabled { opacity: 0.4; cursor: default; }
  output { flex: 1; min-width: 0; text-align: center; font-variant-numeric: tabular-nums; }
  output.restauravel { touch-action: manipulation; user-select: none; cursor: pointer; }
</style>
