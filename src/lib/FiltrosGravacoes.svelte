<script lang="ts">
  import { tick } from "svelte";
  import Segmentado from "./Segmentado.svelte";
  import Icone from "./Icone.svelte";
  import { i18n } from "./i18n/index.svelte";
  import type { Consulta, Filtro } from "./organizar";

  // Os filtros no título (I-39): os três mais usados ficam à mão, e o chevron abre a busca e o filtro "Com metrônomo". Tudo é UM grupo de escolha única (os quatro botões de rádio têm o mesmo nome).
  let { consulta, aoMudar, filtrosAbertos = $bindable(false) }: { consulta: Consulta; aoMudar: (parcial: Partial<Consulta>) => void; filtrosAbertos?: boolean } = $props();
  const escolherFiltro = (filtro: Filtro) => aoMudar({ filtro });

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const FILTROS_RAPIDOS: Filtro[] = ["todas", "favoritas", "hino"];
  // `filtrosAbertos` mora em quem usa (o painel começa fechado; fechado, um ponto no chevron avisa que há filtro escondido): este componente é desmontado com a lista vazia, e a busca continua valendo.
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
          <input class="radio-oculto" type="radio" name="filtro-gravacoes" value="metronomo" checked={consulta.filtro === "metronomo"} onchange={() => escolherFiltro("metronomo")} />
          <span>{#if consulta.filtro === "metronomo"}<Icone nome="ok" tamanho={16} />{/if}{t("gravador.filtro_metronomo")}</span>
        </label>
        <label class="busca">
          <span class="meta">{t("gravador.buscar")}</span>
          <input class="campo-texto" id="buscar-gravacoes" bind:this={buscaEl} type="search" autocomplete="off" enterkeyhint="search" value={consulta.busca} oninput={(e) => aoMudar({ busca: e.currentTarget.value })} />
        </label>
      </div>
    {/if}
  </fieldset>
</div>

<style>
  .controles { display: grid; gap: 0.6rem; }
  .busca { display: grid; gap: var(--espaco-p); }
  .filtros { margin: 0; padding: 0; border: 0; min-width: 0; }
  .linha-filtros { display: flex; gap: 0.4rem; align-items: stretch; }
  .filtros-rapidos { flex: 1; min-width: 0; }
  .filtros label { position: relative; flex: 1 1 auto; }
  .filtros label > span:not(.meta) { display: flex; align-items: center; justify-content: center; gap: var(--espaco-p); min-height: var(--toque); box-sizing: border-box; padding: 0 0.5rem; border-radius: var(--raio); border: var(--borda-padrao); background: var(--superficie); color: var(--texto); }
  .filtros label.ativo > span:not(.meta) { border: var(--borda-destaque); font-weight: 700; }
  .filtros input[type="radio"]:focus-visible + span { outline: var(--anel-foco); outline-offset: var(--anel-foco-recuo); }
  .mais-filtros { position: relative; flex: 0 0 3rem; min-height: var(--toque); display: flex; align-items: center; justify-content: center; border-radius: var(--raio); border: var(--borda-padrao); background: var(--superficie); color: var(--texto); cursor: pointer; }
  .mais-filtros:focus-visible { outline: var(--anel-foco); outline-offset: var(--anel-foco-recuo); }
  /* O ponto: há busca ou "Com metrônomo" ligados com o painel fechado. */
  .mais-filtros.escondido { border: var(--borda-destaque); }
  .mais-filtros.escondido::after { content: ""; position: absolute; top: 0.3rem; right: 0.3rem; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--acento); }
  .painel-filtros { display: grid; gap: 0.6rem; margin-top: 0.6rem; }
  .so-metronomo { display: block; }
</style>
