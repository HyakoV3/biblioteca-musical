<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import ControleAndamento from "./ControleAndamento.svelte";
  import Icone from "./Icone.svelte";
  import { BPM_MAX, BPM_MIN, COMPASSOS } from "./metronomo";
  import { emCurso } from "./gravacaoEmCurso.svelte";
  import { metronomo } from "./metronomo.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { foneConectado } from "./servico";

  // A aba Metrônomo (I-20): um clique regular, com o 1º tempo forte e os demais fracos. O clique NÃO para ao sair da aba nem ao abrir um hino: o estado vive em
  // `metronomo.svelte.ts` e só para quando a pessoa manda (aqui ou na notificação), quando o sistema tira o áudio ou quando um hino começa a tocar (um som de
  // cada vez). `ativa` diz se a aba está à vista: só então a bolinha é redesenhada (escondida, nada a mostrar).
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  // O controle de andamento do player mexe em `cfg.andamento`; aqui ele vai para o estado do metrônomo (que limita a 30..240 e guarda).
  const cfg = {
    get andamento() {
      return metronomo.bpm;
    },
    set andamento(v: number) {
      metronomo.mudarBpm(v);
    },
  };

  /** A posição do pêndulo (0 esquerda, 1 direita) e o tempo aceso do compasso (0 = forte), lidos do relógio de áudio a cada quadro. */
  let posicao = $state(0);
  let aceso = $state<number | null>(null);
  const reduzirMovimento = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let quadro = 0;

  function desenhar() {
    const p = metronomo.posicao();
    const l = metronomo.lado();
    aceso = metronomo.tempoAceso();
    // Pêndulo: a bolinha vai de uma ponta à outra entre dois cliques (cada clique é uma ponta). Com movimento reduzido ela não desliza: só pula de ponta em ponta.
    posicao = p === null ? 0 : reduzirMovimento && l !== null ? l : p;
    quadro = requestAnimationFrame(desenhar);
  }

  $effect(() => {
    if (ativa && metronomo.ligado) {
      quadro = requestAnimationFrame(desenhar);
      return () => cancelAnimationFrame(quadro);
    }
    aceso = null;
    posicao = 0;
  });

  onMount(() => metronomo.carregar());
  onDestroy(() => cancelAnimationFrame(quadro));

  function alternar() {
    if (metronomo.ligado) {
      metronomo.parar();
      return;
    }
    reproducao.parar(); // um som de cada vez: o hino que tocava não toca junto do clique
    // Sem fone, o clique do alto-falante entraria na gravação em curso: ela para. Com fone, os dois seguem (estudar gravando com o clique no ouvido).
    if (emCurso.gravando && !foneConectado()) emCurso.parar?.();
    void metronomo.iniciar();
  }

  const marcas = $derived(Array.from({ length: metronomo.compasso }, (_, i) => i));
  const rotuloCompasso = (n: number) => (n === 1 ? t("metronomo.compasso_um") : t("metronomo.compasso_n", { n }));
</script>

<div class="metronomo">
  <p class="meta">{t("metronomo.explica")}</p>

  {#if metronomo.erroAudio}<Aviso tipo="erro">{t("metronomo.erro_audio")}</Aviso>{/if}
  {#if metronomo.erroServico}<Aviso tipo="erro">{t("metronomo.erro_servico")}</Aviso>{/if}
  {#if metronomo.interrompido}<Aviso tipo="info">{t("metronomo.interrompido")}</Aviso>{/if}

  <div class="andamento"><ControleAndamento {cfg} editavel={true} min={BPM_MIN} max={BPM_MAX} /></div>

  <div class="compasso" role="group" aria-label={t("metronomo.compasso")}>
    <span class="rotulo" aria-hidden="true">{t("metronomo.compasso")}</span>
    <div class="botoes">
      {#each COMPASSOS as n (n)}
        <button class="botao" aria-pressed={metronomo.compasso === n} aria-label={rotuloCompasso(n)} onclick={() => metronomo.mudarCompasso(n)}>{n}</button>
      {/each}
    </div>
  </div>

  <!-- O pêndulo: a bolinha vai e volta entre as duas pontas, e cada clique é uma ponta (como num metrônomo de verdade). Embaixo, uma bolinha por tempo do compasso: a do 1º tempo
       (o forte) é maior, e a do tempo atual fica acesa. Decorativo para o leitor de tela (o aviso de status abaixo basta). -->
  <div class="pendulo" aria-hidden="true" data-aceso={aceso ?? ""} data-posicao={posicao.toFixed(3)}>
    <div class="trilha">
      <span class="ponta esquerda"></span>
      <span class="ponta direita"></span>
      <span class="bola" style:left={`${posicao * 100}%`}></span>
    </div>
    <div class="tempos">
      {#each marcas as i (i)}
        <span class="tempo" class:forte={i === 0} class:aceso={aceso === i}></span>
      {/each}
    </div>
  </div>

  <button id="metronomo-iniciar" class="botao primario grande" aria-pressed={metronomo.ligado} onclick={alternar}>
    {#if metronomo.ligado}
      <Icone nome="stop" tamanho={24} />
      <span>{t("metronomo.parar")}</span>
    {:else}
      <Icone nome="play" tamanho={24} />
      <span>{t("metronomo.iniciar")}</span>
    {/if}
  </button>

  <!-- Só para o leitor de tela: ligou e parou, com o andamento e o compasso. Nunca anuncia tempo a tempo (falaria por cima do clique). -->
  <p class="so-leitor" role="status">{metronomo.ligado ? t("metronomo.status_on", { bpm: metronomo.bpm, n: metronomo.compasso }) : t("metronomo.status_off")}</p>

  {#if metronomo.recentes.length > 0}
    <section class="recentes" aria-labelledby="titulo-recentes">
      <h2 id="titulo-recentes">{t("metronomo.recentes")}</h2>
      <ul>
        {#each metronomo.recentes as r (`${r.bpm}-${r.compasso}`)}
          <li>
            <button class="botao" aria-current={r.bpm === metronomo.bpm && r.compasso === metronomo.compasso} onclick={() => metronomo.usar(r)}>
              {t("metronomo.recente", { bpm: r.bpm, n: r.compasso })}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .metronomo { display: flex; flex-direction: column; gap: 1rem; }
  .meta { margin: 0; color: var(--suave); }
  .andamento { display: flex; }
  .compasso { display: flex; flex-direction: column; gap: 0.5rem; }
  .compasso .rotulo { color: var(--suave); }
  .compasso .botoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .compasso button { flex: 1 0 3rem; min-width: 3rem; min-height: 3rem; font-variant-numeric: tabular-nums; }
  .compasso button[aria-pressed="true"] { font-weight: 700; border-color: var(--ouro-linha); }

  /* O pêndulo: uma trilha com as duas pontas e a bolinha por cima. A posição vem do JavaScript (relógio de áudio); sem transição de CSS, e com movimento reduzido a bolinha só
     pula de ponta em ponta. Embaixo, uma bolinha por tempo do compasso (a do 1º é maior, não só de outra cor). */
  .pendulo { display: flex; flex-direction: column; gap: 0.75rem; margin: 0.25rem 0.75rem; }
  .trilha { position: relative; height: 2.5rem; }
  .trilha::before { content: ""; position: absolute; left: 0; right: 0; top: calc(50% - 0.0625rem); height: 0.125rem; background: var(--borda); }
  .ponta { position: absolute; top: calc(50% - 1rem); width: 0.25rem; height: 2rem; background: var(--texto); }
  .ponta.esquerda { left: -0.125rem; }
  .ponta.direita { right: -0.125rem; }
  .bola { position: absolute; top: calc(50% - 0.75rem); width: 1.5rem; height: 1.5rem; margin-left: -0.75rem; box-sizing: border-box; border-radius: 50%; background: var(--ouro-linha); border: 0.125rem solid var(--texto); }
  .tempos { display: flex; justify-content: center; align-items: center; gap: 0.5rem; min-height: 1.75rem; }
  .tempo { width: 0.75rem; height: 0.75rem; border-radius: 50%; border: 0.125rem solid var(--suave); box-sizing: border-box; }
  .tempo.forte { width: 1.5rem; height: 1.5rem; border-color: var(--texto); }
  .tempo.aceso { background: var(--ouro-linha); border-color: var(--ouro-linha); }

  .grande { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }

  .recentes h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .recentes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .recentes button { width: 100%; min-height: 3rem; justify-content: flex-start; }
  .recentes button[aria-current="true"] { font-weight: 700; border-color: var(--ouro-linha); }
</style>
