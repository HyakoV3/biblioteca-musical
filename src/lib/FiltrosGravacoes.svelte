<script lang="ts">
  import { tick } from "svelte";
  import Segmentado from "./Segmentado.svelte";
  import Icone from "./Icone.svelte";
  import { i18n } from "./i18n/index.svelte";
  import type { Consulta, Filtro } from "./organizar";

  // Os filtros no título (I-39): os três mais usados ficam à mão, e o chevron abre a busca e o filtro "Com metrônomo". Tudo é UM grupo de escolha única (os quatro botões de rádio têm o mesmo nome).
  let { consulta, aoMudar }: { consulta: Consulta; aoMudar: (parcial: Partial<Consulta>) => void } = $props();
  const escolherFiltro = (filtro: Filtro) => aoMudar({ filtro });

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const FILTROS_RAPIDOS: Filtro[] = ["todas", "favoritas", "hino"];
  /** O painel dos filtros (busca e "Com metrônomo"): começa fechado; fechado, um ponto no chevron avisa que há filtro escondido. */
  let filtrosAbertos = $state(false);
  let buscaEl = $state<HTMLInputElement>();
  const filtroEscondido = $derived(consulta.busca.trim() !== "" || consulta.filtro === "metronomo");
  async function alternarFiltros() {
    filtrosAbertos = !filtrosAbertos;
    if (filtrosAbertos) {
      await tick();
      buscaEl?.focus();
    }
  }
</script>

<div class="controles">
  <fieldset class="filtros" id="filtro-gravacoes">
    <legend class="so-leitor">{t("gravador.filtro_legenda")}</legend>
    <div class="linha-filtros">
      <div class="filtros-rapidos">
        <Segmentado
          nome="filtro-gravacoes"
          valor={consulta.filtro}
          opcoes={FILTROS_RAPIDOS.map((f) => ({ valor: f, rotulo: t(`gravador.filtro_${f}`) }))}
          aoEscolher={escolherFiltro}
        />
      </div>
      <button
        type="button"
        id="mais-filtros"
        class="mais-filtros"
        class:escondido={!filtrosAbertos && filtroEscondido}
        aria-expanded={filtrosAbertos}
        aria-controls={filtrosAbertos ? "painel-filtros" : undefined}
        title={t("gravador.mais_filtros")}
        onclick={alternarFiltros}
      >
        <Icone nome={filtrosAbertos ? "fechar" : "abrir"} tamanho={22} />
        <!-- O nome do botão vem do conteúdo (um aria-label o substituiria e o aviso do filtro escondido nunca seria lido). -->
        <span class="so-leitor">{t("gravador.mais_filtros")}{#if !filtrosAbertos && filtroEscondido}{" — "}{t("gravador.filtro_escondido")}{/if}</span>
      </button>
    </div>
    {#if filtrosAbertos}
      <div class="painel-filtros" id="painel-filtros">
        <label class="so-metronomo" class:ativo={consulta.filtro === "metronomo"}>
          <input type="radio" name="filtro-gravacoes" value="metronomo" checked={consulta.filtro === "metronomo"} onchange={() => escolherFiltro("metronomo")} />
          <span>{#if consulta.filtro === "metronomo"}<Icone nome="ok" tamanho={16} />{/if}{t("gravador.filtro_metronomo")}</span>
        </label>
        <label class="busca">
          <span class="meta">{t("gravador.buscar")}</span>
          <input id="buscar-gravacoes" bind:this={buscaEl} type="search" autocomplete="off" enterkeyhint="search" value={consulta.busca} oninput={(e) => aoMudar({ busca: e.currentTarget.value })} />
        </label>
      </div>
    {/if}
  </fieldset>
</div>

<style>
  .controles { display: grid; gap: 0.6rem; }
  .busca { display: grid; gap: 0.25rem; }
  .busca input { box-sizing: border-box; width: 100%; min-height: 3rem; padding: 0 0.75rem; font: inherit; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); color: var(--texto); }
  .filtros { margin: 0; padding: 0; border: 0; min-width: 0; }
  .linha-filtros { display: flex; gap: 0.4rem; align-items: stretch; }
  .filtros-rapidos { flex: 1; min-width: 0; }
  .filtros label { position: relative; flex: 1 1 auto; }
  .filtros input[type="radio"] { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .filtros label > span:not(.meta) { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0 0.5rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .filtros label.ativo > span:not(.meta) { border: 0.125rem solid var(--acento); font-weight: 700; }
  .filtros input[type="radio"]:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .mais-filtros { position: relative; flex: 0 0 3rem; min-height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); cursor: pointer; }
  .mais-filtros:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  /* O ponto: há busca ou "Com metrônomo" ligados com o painel fechado. */
  .mais-filtros.escondido { border: 0.125rem solid var(--acento); }
  .mais-filtros.escondido::after { content: ""; position: absolute; top: 0.3rem; right: 0.3rem; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--acento); }
  .painel-filtros { display: grid; gap: 0.6rem; margin-top: 0.6rem; }
  .so-metronomo { display: block; }
</style>
