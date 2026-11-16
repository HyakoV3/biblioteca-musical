<script lang="ts">
  // Barra de progresso que também avança e retrocede. O que se VÊ é a mesma barra de sempre (trilha `--borda`, preenchimento
  // `--ouro-linha`, as cores de cada tema); por cima fica um <input type="range"> nativo e transparente, que dá o toque, o
  // arraste, o teclado e o leitor de tela sem ter cor própria (o controle nativo usaria o azul do sistema, fora do tema).
  // Enquanto a pessoa arrasta, mostra o ponto escolhido; o som só muda ao SOLTAR, porque reposicionar a música inteira a cada
  // pixel pesaria no celular.
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
    /** Versão do miniplayer: fio de 4 px, sem o ponto de arrastar, numa faixa de toque menor. */
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

<div class="busca" class:fino class:desabilitado={!habilitado} style:--f={fracao(mostrado, duracao)}>
  <div class="trilho"><div class="preenchido"></div></div>
  {#if !fino}<span class="ponto" aria-hidden="true"></span>{/if}
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
  /* A faixa de toque é um espaço RESERVADO no layout (40 px; 20 px no miniplayer): não sobe sobre os controles de cima nem
     desce sobre a barra de abas, então não rouba toques de ninguém. */
  .busca { position: relative; display: flex; align-items: center; height: 40px; --ponto: 22px; }
  .busca.fino { height: 20px; }
  .busca.desabilitado { opacity: 0.5; }

  /* Mesmo desenho de antes: trilha `--borda` com preenchimento `--ouro-linha` (as cores de cada tema). O preenchimento termina
     no centro do ponto, que nunca passa das pontas da barra. */
  .trilho { width: 100%; height: 8px; border-radius: 4px; background: var(--borda); overflow: hidden; }
  .fino .trilho { height: 4px; border-radius: 0; }
  .preenchido { height: 100%; width: calc(var(--ponto) / 2 + (100% - var(--ponto)) * var(--f)); background: var(--ouro-linha); }
  .fino .preenchido { width: calc(100% * var(--f)); }
  .ponto {
    position: absolute; top: 50%; left: calc((100% - var(--ponto)) * var(--f)); margin-top: calc(var(--ponto) / -2);
    width: var(--ponto); height: var(--ponto); box-sizing: border-box; border-radius: 50%;
    background: var(--ouro-linha); border: 3px solid var(--superficie); box-shadow: 0 0 0 1px var(--ouro-linha);
  }

  .busca-entrada { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .busca-entrada:disabled { cursor: default; }

  /* Foco: o input é transparente, então o anel (o do app: 3 px de `--foco`) vai na barra e no ponto. */
  .busca:has(.busca-entrada:focus-visible) .trilho,
  .busca:has(.busca-entrada:focus-visible) .ponto { outline: 3px solid var(--foco); outline-offset: 2px; }
</style>
