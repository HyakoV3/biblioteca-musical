<script lang="ts">
  import Icone from "./Icone.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { ANDAMENTO_MAX, ANDAMENTO_MIN } from "./reproducao.svelte";

  // O controle do andamento (−5 −1 [valor] +1 +5), o mesmo na aba Ouvir e no botão do topo das abas Letra e Partitura. Mexe direto nos ajustes do hino
  // (`cfg`, que vivem no módulo de reprodução), então os dois lugares mostram sempre o mesmo valor.
  let { cfg, editavel }: { cfg: { andamento: number }; editavel: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Andamento em dois passos: 1 bpm (ajuste fino) e 5 bpm (ajuste grosso).
  const PASSO_FINO = 1;
  const PASSO_GROSSO = 5;
  const mudar = (bpm: number) => (cfg.andamento = Math.min(ANDAMENTO_MAX, Math.max(ANDAMENTO_MIN, cfg.andamento + bpm)));
  const item = $derived(t("player.andamento_rotulo").toLowerCase());
</script>

<div class="passo" role="group" aria-label={t("player.andamento_rotulo")}>
  {#each [-PASSO_GROSSO, -PASSO_FINO] as bpm (bpm)}
    <button
      aria-label={t("player.diminuir_n", { item, n: -bpm })}
      disabled={!editavel || cfg.andamento <= ANDAMENTO_MIN}
      onclick={() => mudar(bpm)}>{#if -bpm === PASSO_FINO}<Icone nome="menos" tamanho={24} />{:else}−{-bpm}{/if}</button
    >
  {/each}
  <output aria-live="polite">{t("player.bpm", { n: cfg.andamento })}</output>
  {#each [PASSO_FINO, PASSO_GROSSO] as bpm (bpm)}
    <button
      aria-label={t("player.aumentar_n", { item, n: bpm })}
      disabled={!editavel || cfg.andamento >= ANDAMENTO_MAX}
      onclick={() => mudar(bpm)}>{#if bpm === PASSO_FINO}<Icone nome="mais" tamanho={24} />{:else}+{bpm}{/if}</button
    >
  {/each}
</div>

<style>
  /* Mesmo desenho do controle da aba Ouvir: cinco itens (−5 −1 valor +1 +5) repartindo a largura toda, botões de texto. */
  .passo { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; width: 100%; }
  .passo button {
    display: inline-flex; align-items: center; justify-content: center; flex: none; min-width: 3rem; height: 3rem; width: auto; padding: 0 0.5rem;
    font-size: 1.05rem; font-weight: 600; border-radius: 0.75rem; line-height: 1; cursor: pointer;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .passo output { flex: 1; min-width: 0; text-align: center; font-variant-numeric: tabular-nums; }
</style>
