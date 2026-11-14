<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    titulo,
    subtitulo,
    voltar,
    rotuloVoltar = "",
    acao,
  }: { titulo: string; subtitulo?: string; voltar?: () => void; rotuloVoltar?: string; acao?: Snippet } = $props();
</script>

<header class="barra">
  <div class="coluna linha">
    {#if voltar}
      <button class="voltar" onclick={voltar} aria-label={rotuloVoltar}>←</button>
    {/if}
    <div class="textos">
      <h1 title={titulo}>{titulo}</h1>
      {#if subtitulo}<p>{subtitulo}</p>{/if}
    </div>
    {#if acao}<div class="acao">{@render acao()}</div>{/if}
  </div>
</header>

<style>
  .barra {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--fundo);
    border-bottom: 1px solid var(--borda);
    padding-top: env(safe-area-inset-top);
  }
  .linha { display: flex; align-items: center; gap: 0.5rem; min-height: 56px; }
  .voltar {
    min-width: 48px; min-height: 48px; margin-left: -0.6rem; font-size: 1.5rem; line-height: 1;
    background: transparent; border: 0; color: inherit; cursor: pointer; border-radius: 12px;
  }
  .textos { flex: 1; min-width: 0; }
  h1 {
    margin: 0; font-size: 1.2rem; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  p { margin: 0; font-size: 0.85rem; color: var(--suave); }
  .acao { flex: none; }
</style>
