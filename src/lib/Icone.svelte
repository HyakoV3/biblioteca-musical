<script lang="ts">
  import { corpoDoIcone, type IconeNome } from "./icones";

  // Ícone decorativo: o nome acessível fica no botão ou no texto ao lado (aria-label), então o SVG é escondido do leitor
  // de tela. A cor vem do texto em volta (currentColor), então acompanha os temas.
  let { nome, tamanho = 20 }: { nome: IconeNome; tamanho?: number } = $props();
</script>

<svg class="icone" viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-hidden="true" focusable="false">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- conteúdo local e validado por tools/gerar-icones.mjs -->
  {@html corpoDoIcone(nome)}
</svg>

<style>
  .icone { flex: none; vertical-align: middle; }
</style>
