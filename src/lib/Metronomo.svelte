<script lang="ts">
  import Segmentado from "./Segmentado.svelte";
  import { onDestroy, onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import ControleAndamento from "./ControleAndamento.svelte";
  import Icone from "./Icone.svelte";
  import ListaRecentes from "./ListaRecentes.svelte";
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
  // A bolinha anda por `transform` (só composição, sem refazer o layout a cada quadro): precisa das larguras da trilha e dela mesma, medidas pelo Svelte (ResizeObserver).
  let larguraTrilha = $state(0);
  let larguraBola = $state(0);
  const deslocamento = $derived(posicao * larguraTrilha - larguraBola / 2);

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
  /** Simples: o tempo se divide em 2 (2, 3 e 4 tempos). Compostos: em 3 (6, 9 e 12). */
  const GRUPOS = [
    { id: "simples", rotulo: "metronomo.simples", itens: COMPASSOS.filter((n) => n <= 4) },
    { id: "compostos", rotulo: "metronomo.compostos", itens: COMPASSOS.filter((n) => n >= 6) },
  ] as const;
  const rotuloCompasso = (n: number) => t("metronomo.compasso_n", { n });
</script>

<div class="metronomo">
  <button id="metronomo-iniciar" class="botao primario grande" aria-pressed={metronomo.ligado} onclick={alternar}>
    {#if metronomo.ligado}
      <Icone nome="stop" tamanho={24} />
      <span>{t("metronomo.parar")}</span>
    {:else}
      <Icone nome="play" tamanho={24} />
      <span>{t("metronomo.iniciar")}</span>
    {/if}
  </button>

  {#if metronomo.erroAudio}<Aviso tipo="erro">{t("metronomo.erro_audio")}</Aviso>{/if}
  {#if metronomo.erroServico}<Aviso tipo="erro">{t("metronomo.erro_servico")}</Aviso>{/if}
  {#if metronomo.interrompido}<Aviso tipo="info">{t("metronomo.interrompido")}</Aviso>{/if}

  <div class="andamento"><ControleAndamento {cfg} editavel={true} min={BPM_MIN} max={BPM_MAX} /></div>

  <!-- O compasso em dois grupos, como na teoria: simples (2, 3 e 4 tempos) e compostos (6, 9 e 12, de 3 em 3). Cada grupo tem 3 botões do mesmo tamanho; os dois dividem a largura. -->
  <div class="compasso" role="group" aria-label={t("metronomo.compasso")}>
    {#each GRUPOS as g (g.id)}
      <div class="grupo" role="group" aria-labelledby={`rotulo-${g.id}`}>
        <span class="rotulo" id={`rotulo-${g.id}`}>{t(g.rotulo)}</span>
        <Segmentado
          nome="compasso"
          valor={metronomo.compasso}
          opcoes={g.itens.map((n) => ({ valor: n, rotulo: String(n), aria: rotuloCompasso(n) }))}
          aoEscolher={(n) => metronomo.mudarCompasso(n)}
        />
      </div>
    {/each}
  </div>

  <!-- O pêndulo: a bolinha vai e volta entre as duas pontas, e cada clique é uma ponta (como num metrônomo de verdade). Embaixo, uma bolinha por tempo do compasso: a do 1º tempo
       (o forte) é maior, e a do tempo atual fica acesa. Decorativo para o leitor de tela (o aviso de status abaixo basta). -->
  <div class="pendulo" aria-hidden="true" data-aceso={aceso ?? ""}>
    <div class="trilha" bind:clientWidth={larguraTrilha}>
      <span class="ponta esquerda"></span>
      <span class="ponta direita"></span>
      <span class="bola" bind:clientWidth={larguraBola} style:transform={`translateX(${deslocamento.toFixed(2)}px)`}></span>
    </div>
    <div class="tempos">
      {#each marcas as i (i)}
        <span class="tempo" class:forte={i === 0} class:aceso={aceso === i}></span>
      {/each}
    </div>
  </div>

  <!-- Só para o leitor de tela: ligou e parou, com o andamento e o compasso. Nunca anuncia tempo a tempo (falaria por cima do clique). -->
  <p class="so-leitor" role="status">{metronomo.ligado ? t("metronomo.status_on", { bpm: metronomo.bpm, n: metronomo.compasso }) : t("metronomo.status_off")}</p>

  <ListaRecentes
    titulo={t("metronomo.recentes")}
    itens={metronomo.recentes}
    rotulo={(r) => t("metronomo.recente", { bpm: r.bpm, n: r.compasso })}
    atual={(r) => r.bpm === metronomo.bpm && r.compasso === metronomo.compasso}
    aoEscolher={(r) => metronomo.usar(r)}
    {ativa}
  />
</div>

<style>
  .metronomo { display: flex; flex-direction: column; gap: 1rem; }
  .andamento { display: flex; }
  .compasso { display: flex; gap: 1rem; }
  .grupo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.375rem; }
  .compasso .rotulo { color: var(--suave); font-size: 0.9rem; }

  /* O pêndulo: uma trilha com as duas pontas e a bolinha por cima. A posição vem do JavaScript (relógio de áudio) e vira `transform` (sem layout por quadro); sem transição de CSS, e com movimento reduzido a bolinha só
     pula de ponta em ponta. Embaixo, uma bolinha por tempo do compasso (a do 1º é maior, não só de outra cor). */
  .pendulo { display: flex; flex-direction: column; gap: 0.75rem; margin: 0.25rem 0.75rem; }
  .trilha { position: relative; height: 2.5rem; }
  .trilha::before { content: ""; position: absolute; left: 0; right: 0; top: calc(50% - 0.0625rem); height: 0.125rem; background: var(--borda); }
  .ponta { position: absolute; top: calc(50% - 1rem); width: 0.25rem; height: 2rem; background: var(--texto); }
  .ponta.esquerda { left: -0.125rem; }
  .ponta.direita { right: -0.125rem; }
  .bola { position: absolute; top: calc(50% - 0.75rem); left: 0; width: 1.5rem; height: 1.5rem; box-sizing: border-box; border-radius: 50%; background: var(--ouro-linha); border: 0.125rem solid var(--texto); }
  .tempos { display: flex; justify-content: center; align-items: center; gap: 0.5rem; min-height: 1.75rem; }
  .tempo { width: 0.75rem; height: 0.75rem; border-radius: 50%; border: 0.125rem solid var(--suave); box-sizing: border-box; }
  .tempo.forte { width: 1.5rem; height: 1.5rem; border-color: var(--texto); }
  .tempo.aceso { background: var(--ouro-linha); border-color: var(--ouro-linha); }

  .grande { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }
</style>
