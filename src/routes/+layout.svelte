<script lang="ts">
  import { onMount } from "svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";

  let { children } = $props();

  // O conteúdo é carregado uma vez, para todas as telas.
  onMount(() => biblioteca.carregar());

  // Mantém o atributo lang do documento em sintonia com o idioma escolhido.
  $effect(() => {
    document.documentElement.lang = i18n.idioma;
  });
</script>

{@render children()}

<style>
  :global(:root) {
    --fundo: #f6f6f6;
    --superficie: #fff;
    --texto: #1d1d1f;
    --suave: #666;
    --borda: #ccc;
    --perigo: #b00020;
    font-family: system-ui, sans-serif;
    color: var(--texto);
    background: var(--fundo);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --fundo: #1b1b1d;
      --superficie: #2a2a2d;
      --texto: #eee;
      --suave: #aaa;
      --borda: #444;
      --perigo: #ff928a;
    }
  }
  :global(body) { margin: 0; -webkit-text-size-adjust: 100%; }
  /* Coluna central; respeita o recorte da câmera e a barra de gestos (viewport-fit=cover). */
  :global(.coluna) {
    max-width: 640px; margin: 0 auto; box-sizing: border-box;
    padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));
  }
  :global(.conteudo) { padding-top: 1rem; padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }
  :global(.meta) { color: var(--suave); font-size: 0.9rem; }
  :global(.erro) { color: var(--perigo); }
  :global(.botao) {
    display: inline-flex; align-items: center; justify-content: center; min-height: 48px; box-sizing: border-box;
    padding: 0 1rem; font-size: 1rem; text-decoration: none; border-radius: 12px; border: 1px solid var(--borda);
    background: var(--superficie); color: inherit; cursor: pointer;
  }
  :global(.botao.perigo) { color: var(--perigo); }
</style>
