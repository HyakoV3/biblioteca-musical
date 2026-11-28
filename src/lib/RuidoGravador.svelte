<script lang="ts">
  import Segmentado from "./Segmentado.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { FILTROS_DE_RUIDO, type FiltroDeRuido } from "./filtroDeRuido";

  // A pílula do filtro de ruído: um grupo de escolha única, de um controle só (Desligado, Baixo, Médio, Alto), travado enquanto grava. O nome técnico do filtro escolhido vem numa linha miúda embaixo.
  let { filtro, gravando, aoEscolher }: { filtro: FiltroDeRuido; gravando: boolean; aoEscolher: (f: FiltroDeRuido) => void } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
</script>

<fieldset class="ruido" id="filtro-de-ruido" disabled={gravando}>
  <legend class="meta">{t("gravador.reduzir_ruido")}</legend>
  <Segmentado nome="filtro-de-ruido" valor={filtro} opcoes={FILTROS_DE_RUIDO.map((f) => ({ valor: f, rotulo: t(`gravador.ruido_${f}`) }))} {aoEscolher} />
  <p class="meta ruido-tecnico" id="ruido-tecnico">{t(`gravador.ruido_tec_${filtro}`)}</p>
  {#if filtro === "rnnoise" || filtro === "gtcrn"}<p class="meta" id="ruido-aviso">{t("gravador.ruido_aviso")}</p>{/if}
</fieldset>

<style>
  /* A pílula do filtro de ruído: 4 opções de escolha única, que quebram de linha em tela estreita. */
  .ruido { margin: 0 0 0.75rem; padding: 0; border: 0; min-width: 0; }
  .ruido legend { padding: 0; margin-bottom: 0.25rem; }
  .ruido-tecnico { margin: 0.35rem 0 0; font-size: 0.8rem; text-align: center; min-height: 1.1rem; }
</style>
