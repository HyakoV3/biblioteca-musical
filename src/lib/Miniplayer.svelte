<script lang="ts">
  import { i18n } from "$lib/i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { formatarTempo, fracao } from "./tempo";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Aparece enquanto há um hino tocando ou pausado, exceto na tela do próprio hino com o painel
  // Ouvir aberto (lá os controles completos já estão visíveis).
  const atual = $derived(reproducao.atual);
  const visivel = $derived(atual !== null && reproducao.painelNumero !== atual.numero);
  const tocando = $derived(reproducao.estado === "tocando");

  // Reserva espaço no fim das telas para o miniplayer não cobrir o conteúdo. Usa a altura medida
  // (cresce com fonte ampliada), em vez de um valor fixo.
  let altura = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty("--altura-miniplayer", visivel ? `${altura}px` : "0px");
  });
</script>

{#if visivel && atual}
  <div class="mini" role="region" aria-label={t("mini.regiao")} bind:clientHeight={altura}>
    <div class="coluna linha">
      <button
        class="acao"
        onclick={() => reproducao.alternarAtual()}
        aria-label={tocando ? t("audio.pausar") : t("audio.continuar")}
      >
        {tocando ? "❚❚" : "▶"}
      </button>
      <a class="info" href={`/hino/${atual.numero}`}>
        <span class="titulo">{atual.numero} · {atual.titulo}</span>
        <span class="tempo">{formatarTempo(reproducao.decorrido)} / {formatarTempo(reproducao.duracao)}</span>
      </a>
      <button class="acao" onclick={() => reproducao.parar()} aria-label={t("audio.parar")}>■</button>
    </div>
    <div
      class="fio"
      role="progressbar"
      aria-label={t("player.progresso_rotulo")}
      aria-valuemin="0"
      aria-valuemax={Math.round(reproducao.duracao)}
      aria-valuenow={Math.round(reproducao.decorrido)}
      aria-valuetext={t("player.progresso", {
        atual: formatarTempo(reproducao.decorrido),
        total: formatarTempo(reproducao.duracao),
      })}
    >
      <div class="preenchido" style:width={`${fracao(reproducao.decorrido, reproducao.duracao) * 100}%`}></div>
    </div>
  </div>
{/if}

<style>
  .mini {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
    background: var(--superficie); border-top: 1px solid var(--borda-controle);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .linha { display: flex; align-items: center; gap: 0.5rem; min-height: 64px; }
  .acao {
    flex: none; width: 48px; height: 48px; font-size: 1.2rem; border-radius: 12px;
    border: 0; background: transparent; color: var(--texto); cursor: pointer;
  }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; text-decoration: none; color: var(--texto); }
  .titulo { overflow-wrap: anywhere; font-weight: 600; }
  .tempo { font-size: 0.8rem; color: var(--suave); font-variant-numeric: tabular-nums; }
  .fio { height: 4px; background: var(--borda); }
  .preenchido { height: 100%; background: var(--acento); }
</style>
