<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import Busca from "./Busca.svelte";
  import Icone from "./Icone.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { rotuloDaParte } from "./rotulo-vez";
  import { formatarTempo } from "./tempo";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Aparece enquanto há um hino tocando ou pausado, exceto na tela do próprio hino com o painel
  // Ouvir aberto (lá os controles completos já estão visíveis).
  const atual = $derived(reproducao.atual);
  const visivel = $derived(atual !== null && reproducao.painelNumero !== atual.numero);
  const tocando = $derived(reproducao.estado === "tocando");
  // O ponto que a pessoa está arrastando na barra (nulo quando não arrasta).
  let previaBusca = $state<number | null>(null);
  // Diz qual parte está soando ("Introdução", "Terceira vez · final"), também dentro do "hino todo".
  const parte = $derived.by(() => {
    const p = reproducao.parteTocando;
    if (!atual || p === null || (p !== "intro" && atual.total <= 1)) return "";
    return rotuloDaParte(p, atual.comFinal && p === atual.total);
  });

  // Reserva espaço no fim das telas para o miniplayer não cobrir o conteúdo. Usa a altura medida
  // (cresce com fonte ampliada), em vez de um valor fixo.
  let altura = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty("--altura-miniplayer", visivel ? `${altura}px` : "0px");
  });
</script>

{#if visivel && atual}
  <div class="mini" role="region" aria-label={t("mini.regiao")} bind:clientHeight={altura}>
    <!-- O slider fica EM CIMA: embaixo, o dourado dele ficava a ~0,5rem do traço dourado da aba ativa e parecia parte da barra de abas. -->
    <Busca
      fino
      decorrido={reproducao.decorrido}
      duracao={reproducao.duracao}
      habilitado={reproducao.duracao > 0}
      aoBuscar={(s) => reproducao.irPara(s)}
      bind:previa={previaBusca}
    />
    <div class="coluna linha">
      <button
        class="acao"
        onclick={() => reproducao.alternarAtual()}
        aria-label={tocando ? t("audio.pausar") : t("audio.continuar")}
      >
        <Icone nome={tocando ? "pause" : "play"} tamanho={24} />
      </button>
      <a class="info" href={`/hino/${atual.numero}`}>
        <span class="titulo">{atual.numero} · {atual.titulo}</span>
        <span class="tempo"
          >{parte ? `${parte} · ` : ""}{formatarTempo(previaBusca ?? reproducao.decorrido)} / {formatarTempo(reproducao.duracao)}</span
        >
      </a>
      <button class="acao" onclick={() => reproducao.parar()} aria-label={t("audio.parar")}><Icone nome="stop" tamanho={24} /></button>
    </div>
  </div>
{/if}

<style>
  .mini {
    /* Sobe acima da barra de abas (--altura-navegacao) ou se afasta da barra lateral (--largura-trilho), quando existem. */
    position: fixed; left: var(--largura-trilho, 0rem); right: 0; bottom: var(--altura-navegacao, 0rem); z-index: 20;
    background: var(--superficie); border-top: 0.0625rem solid var(--borda-controle);
    padding-bottom: var(--inset-miniplayer, env(safe-area-inset-bottom));
  }
  .linha { display: flex; align-items: center; gap: 0.5rem; min-height: 3.5rem; } /* + 1,25rem do slider (em cima) = 4,75rem, mais a borda */
  .acao {
    flex: none; width: 3rem; height: 3rem; font-size: 1.2rem; border-radius: 0.75rem;
    border: 0; background: transparent; color: var(--texto); cursor: pointer;
  }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; text-decoration: none; color: var(--texto); }
  .titulo { overflow-wrap: anywhere; font-weight: 600; }
  .tempo { font-size: 0.8rem; color: var(--suave); font-variant-numeric: tabular-nums; }
</style>
