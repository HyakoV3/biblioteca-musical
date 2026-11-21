<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import ControleAndamento from "./ControleAndamento.svelte";
  import Icone from "./Icone.svelte";
  import { BPM_MAX, BPM_MIN, COMPASSOS } from "./metronomo";
  import { metronomo } from "./metronomo.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";

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

  /** A posição da bolinha na trilha (0 a 1) e o tempo aceso (0 = forte), lidos do relógio de áudio a cada quadro. */
  let posicao = $state(0);
  let aceso = $state<number | null>(null);
  const reduzirMovimento = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let quadro = 0;

  function desenhar() {
    const p = metronomo.progresso();
    const a = metronomo.tempoAceso();
    aceso = a;
    // Com movimento reduzido a bolinha não desliza: fica na marca do tempo atual (só muda de lugar a cada tempo).
    posicao = p === null ? 0 : reduzirMovimento && a !== null ? a / metronomo.compasso : p;
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
    void metronomo.iniciar();
  }

  const marcas = $derived(Array.from({ length: metronomo.compasso }, (_, i) => i));
</script>

<div class="metronomo">
  <p class="meta">{t("metronomo.explica")}</p>

  {#if metronomo.erroAudio}<Aviso tipo="erro">{t("metronomo.erro_audio")}</Aviso>{/if}
  {#if metronomo.interrompido}<Aviso tipo="info">{t("metronomo.interrompido")}</Aviso>{/if}

  <div class="andamento"><ControleAndamento {cfg} editavel={true} min={BPM_MIN} max={BPM_MAX} /></div>

  <div class="compasso" role="group" aria-label={t("metronomo.compasso")}>
    {#each COMPASSOS as n (n)}
      <button class="botao" aria-pressed={metronomo.compasso === n} onclick={() => metronomo.mudarCompasso(n)}>{t("metronomo.compasso_n", { n })}</button>
    {/each}
  </div>

  <!-- A trilha do compasso: uma marca por tempo (a do 1º tempo é maior e mais alta, não só de outra cor) e a bolinha que desliza da esquerda para a direita
       e passa por cada marca exatamente no clique. Decorativa para o leitor de tela (o aviso de status abaixo basta). -->
  <div class="trilha" aria-hidden="true" data-aceso={aceso ?? ""} data-posicao={posicao.toFixed(3)}>
    {#each marcas as i (i)}
      <span class="marca" class:forte={i === 0} class:acesa={aceso === i} style:left={`${(i / metronomo.compasso) * 100}%`}></span>
    {/each}
    <span class="bola" style:left={`${posicao * 100}%`}></span>
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
  .compasso { display: flex; gap: 0.5rem; }
  .compasso button { flex: 1; min-height: 3rem; }
  .compasso button[aria-pressed="true"] { font-weight: 700; border-color: var(--ouro-linha); }

  /* A trilha: uma linha fina com as marcas dos tempos e a bolinha por cima. A posição vem do JavaScript (relógio de áudio); sem transição de CSS, e com
     movimento reduzido a bolinha só pula de marca em marca. */
  .trilha { position: relative; height: 3rem; margin: 0.25rem 0.75rem; }
  .trilha::before { content: ""; position: absolute; left: 0; right: 0; top: calc(50% - 0.0625rem); height: 0.125rem; background: var(--borda); }
  .marca { position: absolute; top: calc(50% - 0.5rem); width: 0.125rem; margin-left: -0.0625rem; height: 1rem; background: var(--suave); }
  .marca.forte { top: calc(50% - 1.125rem); height: 2.25rem; width: 0.25rem; margin-left: -0.125rem; background: var(--texto); }
  .marca.acesa { background: var(--ouro-linha); }
  .bola { position: absolute; top: calc(50% - 0.75rem); width: 1.5rem; height: 1.5rem; margin-left: -0.75rem; box-sizing: border-box; border-radius: 50%; background: var(--ouro-linha); border: 0.125rem solid var(--texto); }

  .grande { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }

  .recentes h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .recentes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .recentes button { width: 100%; min-height: 3rem; justify-content: flex-start; }
  .recentes button[aria-current="true"] { font-weight: 700; border-color: var(--ouro-linha); }
</style>
