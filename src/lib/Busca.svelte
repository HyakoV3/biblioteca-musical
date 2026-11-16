<script lang="ts">
  // Barra de progresso que também avança e retrocede: um <input type="range"> nativo (toque, arraste, teclado e leitor de
  // tela de graça). Enquanto a pessoa arrasta, mostra o ponto escolhido; o som só muda ao SOLTAR, porque reposicionar a
  // música inteira a cada pixel pesaria no celular.
  import { i18n } from "$lib/i18n/index.svelte";
  import { formatarTempo, fracao } from "./tempo";

  let {
    decorrido,
    duracao,
    habilitado,
    aoBuscar,
    fino = false,
    previa = $bindable(null),
  }: {
    decorrido: number;
    duracao: number;
    habilitado: boolean;
    /** Chamado ao soltar, com o ponto escolhido em segundos. */
    aoBuscar: (segundos: number) => void;
    /** Versão do miniplayer: um fio de 4 px à vista, com uma área de toque (20 px) reservada no layout e invisível por cima. */
    fino?: boolean;
    /** O ponto que a pessoa está arrastando (nulo quando não arrasta), para quem mostra o tempo ao lado. */
    previa?: number | null;
  } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const mostrado = $derived(previa ?? decorrido);
  const maximo = $derived(Math.max(1, Math.ceil(duracao)));
  const valorTexto = $derived(t("player.progresso", { atual: formatarTempo(mostrado), total: formatarTempo(duracao) }));

  function soltou(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    previa = null;
    aoBuscar(v);
  }
</script>

<div class="busca" class:fino>
  {#if fino}
    <div class="fio" aria-hidden="true"><div class="preenchido" style:width={`${fracao(mostrado, duracao) * 100}%`}></div></div>
  {/if}
  <input
    class="busca-entrada"
    type="range"
    min="0"
    max={maximo}
    step="1"
    value={mostrado}
    disabled={!habilitado}
    aria-label={t("player.progresso_rotulo")}
    aria-valuetext={valorTexto}
    oninput={(e) => (previa = Number(e.currentTarget.value))}
    onchange={soltou}
    onblur={() => (previa = null)}
    onpointercancel={() => (previa = null)}
  />
</div>

<style>
  .busca { position: relative; }
  .busca-entrada { display: block; width: 100%; margin: 0; min-height: 48px; accent-color: var(--acento); }
  .busca-entrada:disabled { opacity: 0.5; }

  /* Miniplayer: o fio de 4 px é o que se vê, e a área de toque (20 px) é um espaço RESERVADO no layout, com o input transparente
     preenchendo-o. Não sobe sobre os botões da linha de cima nem desce sobre a barra de abas, então não rouba toques de ninguém. */
  .fino { height: 20px; display: flex; align-items: center; }
  .fino .fio { width: 100%; height: 4px; background: var(--borda); }
  .fino .preenchido { height: 100%; background: var(--ouro-linha); }
  .fino .busca-entrada { position: absolute; inset: 0; height: 100%; min-height: 0; opacity: 0; cursor: pointer; }
  .fino:has(.busca-entrada:focus-visible) .fio { outline: 2px solid var(--acento); outline-offset: 2px; }
</style>
