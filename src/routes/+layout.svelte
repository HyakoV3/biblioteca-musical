<script lang="ts">
  import "$lib/tema.css";
  import "$lib/movimento.css";
  import { onMount } from "svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import Miniplayer from "$lib/Miniplayer.svelte";
  import { sons } from "$lib/sons/pacotes.svelte";
  import { aplicarEstilo, aplicarTema, estilo, tema } from "$lib/tema.svelte";

  let { children } = $props();

  // O conteúdo é carregado uma vez, para todas as telas.
  onMount(() => {
    biblioteca.carregar();
    sons.atualizar(); // quais sons gravados já estão instalados
  });

  // Mantém o atributo lang do documento em sintonia com o idioma escolhido.
  $effect(() => {
    document.documentElement.lang = i18n.idioma;
  });

  // Aplica a aparência escolhida: o modo (Automático, Claro ou Escuro) e o estilo de cor (normal, pergaminho, marinho).
  $effect(() => {
    aplicarTema(tema.atual);
    aplicarEstilo(estilo.atual);
  });
</script>

{@render children()}
<Miniplayer />

<style>
  :global(:root) {
    font-family: system-ui, sans-serif;
    color: var(--texto);
    background: var(--fundo);
  }
  /* --largura-trilho: a barra lateral de abas (celular deitado) ocupa o lado esquerdo; a página inteira se afasta dela. */
  :global(body) { margin: 0; -webkit-text-size-adjust: 100%; padding-left: var(--largura-trilho, 0px); }
  /* Anel de foco visível para teclado e leitores de tela com navegação por foco. */
  :global(:focus-visible) { outline: 3px solid var(--foco); outline-offset: 2px; }
  :global(a) { color: var(--acento); }
  /* Coluna central; respeita o recorte da câmera e a barra de gestos (viewport-fit=cover). */
  :global(.coluna) {
    max-width: 640px; margin: 0 auto; box-sizing: border-box;
    padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));
  }
  :global(.conteudo) {
    padding-top: 1rem;
    /* --altura-miniplayer e --altura-navegacao (barra de abas) são definidas por quem as mostra. */
    padding-bottom: calc(
      var(--altura-miniplayer, 0px) + var(--altura-navegacao, 0px) + max(1.5rem, env(safe-area-inset-bottom))
    );
  }
  :global(.meta) { color: var(--suave); font-size: 0.9rem; }
  /* Texto só para leitores de tela. */
  :global(.so-leitor) {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  :global(.botao) {
    display: inline-flex; align-items: center; justify-content: center; min-height: 48px; box-sizing: border-box;
    padding: 0 1rem; font-size: 1rem; text-decoration: none; border-radius: 12px;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto); cursor: pointer;
  }
  :global(.botao.primario) { background: var(--acento); color: var(--acento-texto); border-color: var(--acento); font-weight: 600; }
  /* A parte do hino que está tocando: dourado. O contorno escuro dá contraste também no tema claro. */
  :global(.botao.tocando) { background: var(--ouro); color: var(--ouro-sobre); border: 2px solid var(--ouro-linha); font-weight: 600; }
  :global(.flag) { color: var(--ouro-linha); font-weight: 700; }
  :global(.botao.tocando .flag) { color: inherit; }
  :global(.botao.perigo) { color: var(--perigo); border-color: var(--perigo); }
  :global(.botao:disabled) { opacity: 0.5; cursor: not-allowed; }
</style>
